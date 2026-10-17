// Telepen: the barcode UK university libraries use on their cards (Durham's included).
// Neither the phone's own barcode reader nor ZXing reads it, so the app does it here.
//
// How Telepen works: a start character "_", the data, a check character and a stop
// character "z". Every character is a 7-bit ASCII code plus a parity bit (making the number of
// 1s even), drawn lowest bit first, 16 units wide. A 1 is a narrow bar and a narrow space; two
// 0s together are a wide bar and a narrow space; a 0, some 1s and a 0 are drawn as
// "wide bar, wide space" (one 1 between) or "narrow bar, wide space … narrow bar, wide space".
// Wide is 3 units. Library cards use number mode: each pair of digits is one character
// (27 + the pair, "00" to "99"), and a last odd digit is 17 + the digit.

const START = 95; // "_"
const STOP = 122; // "z"

// The bar and space widths (1 or 3 units, starting with a bar) for one character, 0–127.
export function charWidths(code) {
  let byte = code & 0x7f;
  let ones = 0;
  for (let b = 0; b < 7; b++) ones += (byte >> b) & 1;
  if (ones % 2) byte |= 0x80; // even parity
  const bits = [];
  for (let b = 0; b < 8; b++) bits.push((byte >> b) & 1);
  const widths = [];
  for (let i = 0; i < 8;) {
    if (bits[i]) {
      widths.push(1, 1);
      i += 1;
    } else if (!bits[i + 1]) {
      widths.push(3, 1);
      i += 2;
    } else {
      let j = i + 1;
      while (bits[j]) j++; // the next 0 (there always is one: the 0s come in pairs)
      const between = j - i - 1;
      if (between === 1) widths.push(3, 3);
      else widths.push(1, 3, ...Array(2 * (between - 2)).fill(1), 1, 3);
      i = j + 1;
    }
  }
  return widths;
}

const CHARS = Array.from({ length: 128 }, (_, code) => charWidths(code));
const BY_PATTERN = new Map(CHARS.map((w, code) => [w.join(''), code]));

// The check character for some data characters.
export function checkChar(codes) {
  const check = 127 - (codes.reduce((a, b) => a + b, 0) % 127);
  return check === 127 ? 0 : check;
}

// Characters for some digits in number mode, e.g. "201043" → [47, 37, 70].
export function numberCodes(digits) {
  const codes = [];
  for (let i = 0; i < digits.length; i += 2) {
    const pair = digits.slice(i, i + 2);
    codes.push(pair.length === 2 ? 27 + Number(pair) : 17 + Number(pair));
  }
  return codes;
}

// The digits for number-mode characters, or null if a character isn't a digit pair.
export function digitsOf(codes) {
  let digits = '';
  for (const [i, code] of codes.entries()) {
    if (code >= 27 && code <= 126) digits += String(code - 27).padStart(2, '0');
    else if (code >= 17 && code <= 26 && i === codes.length - 1) digits += String(code - 17);
    else return null;
  }
  return digits;
}

// Bar and space widths (in units, starting with a bar) for a value: digits in number mode,
// or any ASCII text otherwise. Throws a plain message if it can't be drawn.
export function telepenWidths(value, { numeric = false } = {}) {
  let codes;
  if (numeric) {
    if (!/^\d+$/.test(value)) throw new Error('Telepen (numbers) can only hold digits.');
    codes = numberCodes(value);
  } else {
    codes = [...value].map((c) => {
      const n = c.charCodeAt(0);
      if (n > 127) throw new Error(`Telepen can't include “${c}”.`);
      return n;
    });
  }
  return [START, ...codes, checkChar(codes), STOP].flatMap((code) => CHARS[code]);
}

// Reads a Telepen barcode on a row (getSize(), get(i): true = dark), in either direction.
// Returns { codes, numeric, value }: the data characters, and the value as digits (number mode)
// or text. Null if there's no barcode, or its check character is wrong.
export function readTelepen(row) {
  const size = row.getSize();
  const forward = runsOf((i) => row.get(i), size);
  return fromRuns(forward) || fromRuns(runsOf((i) => row.get(size - 1 - i), size));
}

function runsOf(get, size) {
  const runs = [];
  for (let i = 0; i < size; i++) {
    const dark = !!get(i);
    const last = runs[runs.length - 1];
    if (last && last.dark === dark) last.length++;
    else runs.push({ dark, length: 1 });
  }
  return runs;
}

function fromRuns(runs) {
  for (let s = 0; s < runs.length; s++) {
    if (!runs[s].dark) continue;
    const found = decodeFrom(runs, s);
    if (found) return found;
  }
  return null;
}

// Decodes characters starting at runs[s], which must be the start character "_" with white
// space before it.
function decodeFrom(runs, s) {
  const codes = [];
  let i = s;
  let unit = 0;
  for (;;) {
    if (!unit) {
      // The start character is 12 parts: ten narrow, then a wide bar and a wide space.
      if (i + 12 > runs.length) return null;
      unit = runs.slice(i, i + 12).reduce((a, r) => a + r.length, 0) / 16;
      if (unit < 1) return null;
      if (s > 0 && runs[s - 1].length < unit * 4) return null; // no white space before
    }
    const char = readChar(runs, i, unit);
    if (!char) return null;
    if (!codes.length && char.code !== START) return null;
    codes.push(char.code);
    unit = char.size / 16; // follow the size along the barcode (photos are rarely flat)
    i = char.next;
    if (char.code === STOP && codes.length >= 3) {
      if (i < runs.length && char.after < unit * 4) return null; // white space must follow
      const data = codes.slice(1, -2);
      if (checkChar(data) !== codes[codes.length - 2]) return null;
      const digits = digitsOf(data);
      return { codes: data, numeric: digits !== null, value: digits ?? String.fromCharCode(...data) };
    }
    if (char.after || codes.length > 64) return null; // white space before the stop character
  }
}

// One character from runs[i]: parts that are each 1 or 3 units and add up to 16. The last
// part is a space, which may run on into white space after the barcode: then only what the
// character needs is counted, and `after` says how much white space was left over.
function readChar(runs, i, unit) {
  const widths = [];
  let units = 0;
  let size = 0;
  let after = 0;
  let k = i;
  while (units < 16) {
    const run = runs[k];
    if (!run || run.dark !== (widths.length % 2 === 0)) return null;
    const need = 16 - units;
    const w = run.length / unit;
    let width = w < 2 ? 1 : 3;
    if (!run.dark && (need === 1 || need === 3) && w > need + 1.5) {
      width = need; // the space runs on into white space
      after = run.length - need * unit;
    } else if (w < 0.4 || w > 4.5) {
      return null;
    }
    widths.push(width);
    units += width;
    size += after ? width * unit : run.length;
    k++;
  }
  if (units !== 16) return null;
  const code = BY_PATTERN.get(widths.join(''));
  return code === undefined ? null : { code, size, next: k, after };
}
