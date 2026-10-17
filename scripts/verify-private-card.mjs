// Local investigation only: never print decoder values, raw patterns, OCR text or exceptions.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { prepareZXingModule, readBarcodes, writeBarcode } from 'zxing-wasm';
import bwip from 'bwip-js/node';
const imagePath = resolve(process.argv[2] ?? 'credentials/durham-card-reference.jpg');
try {
  prepareZXingModule({ overrides: { wasmBinary: readFileSync('node_modules/zxing-wasm/dist/full/zxing_full.wasm'), print: () => {}, printErr: () => {} } });
  const image = new Uint8Array(readFileSync(imagePath));
  const ocr = JSON.parse(readFileSync('credentials/private-ocr-result.json', 'utf8'));
  const matches = [];
  const attempts = [];
  for (const format of ['TelepenNumeric', 'TelepenAlpha', 'Code128', 'ITF']) {
    const results = await readBarcodes(image, { formats: [format], textMode: 'Plain', tryHarder: true, tryRotate: true });
    for (const result of results) {
      const printedMatch = ocr.some(x => x.lines.some(line => line.replace(/\s/g, '') === result.text));
      attempts.push({ format: result.format, variant: result.symbologyIdentifier, checksumValid: result.isValid && !result.error, printedNumberMatches: printedMatch });
      if (printedMatch && result.isValid && !result.error) matches.push(result);
    }
    if (!results.length) attempts.push({ format, decoded: false });
  }
  if (matches.length !== 1) throw new Error();
  const card = matches[0];
  const patterns = {};
  for (const [name, bcid] of Object.entries({ TelepenNumeric: 'telepennumeric', TelepenAlpha: 'telepen', Code128: 'code128', ITF: 'interleaved2of5' })) patterns[name] = bwip.raw({ bcid, text: card.text })[0].sbs;
  const patternCheck = spawnSync('python', ['scripts/private-pattern-check.py', imagePath], { input: JSON.stringify({ position: card.position, patterns }), encoding: 'utf8', windowsHide: true });
  if (patternCheck.status !== 0) throw new Error();
  const generated = await writeBarcode(card.bytes, { format: card.format, scale: 3 });
  const roundTrip = generated.image ? await readBarcodes(generated.image, { formats: [card.format], textMode: 'Plain' }) : [];
  const target = patterns.TelepenNumeric.slice();
  if (target.length % 2 === 0) target.pop();
  function symbolMatches(blackIsLow) {
    const { data, width, height } = generated.symbol;
    const row = Array.from(data.slice(Math.floor(height / 2) * width, (Math.floor(height / 2) + 1) * width), p => blackIsLow ? p < 128 : p >= 128);
    while (row.length && !row[0]) row.shift();
    while (row.length && !row.at(-1)) row.pop();
    const runs = []; let previous = row[0], length = 0;
    for (const bit of row) { if (bit === previous) length++; else { runs.push(length); previous = bit; length = 1; } }
    if (length) runs.push(length);
    const module = Math.min(...runs);
    return runs.length === target.length && runs.every((n, i) => n / module === target[i]);
  }
  const start1 = [1,1,1,1,1,1,1,1,1,1,3,3];
  const stop1 = [3,3,1,1,1,1,1,1,1,1,1];
  console.log(JSON.stringify({ attempts, independentPatternComparison: JSON.parse(patternCheck.stdout), numericUsesStart1Stop1: target.slice(0,12).every((n,i) => n === start1[i]) && target.slice(-11).every((n,i) => n === stop1[i]), applicationWriterMatchesIndependentPattern: symbolMatches(true) || symbolMatches(false), exactGeneratedRoundTrip: roundTrip.length === 1 && roundTrip[0].text === card.text && roundTrip[0].symbologyIdentifier === card.symbologyIdentifier }));
} catch { console.error('Private verification could not finish; no credential details were printed.'); process.exitCode = 1; }
