// Draws the barcode types campus and library cards commonly use (Code 128, Code 39, Codabar)
// as an SVG, so a scanned card can be shown again without needing the camera or internet.

export const FORMATS = {
  code_128: 'Code 128',
  code_39: 'Code 39',
  codabar: 'Codabar',
};

// Code 128: bar/space widths for each symbol value 0–106 (106 is the stop symbol).
const C128 = (
  '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 ' +
  '221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
  '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 ' +
  '212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
  '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 ' +
  '231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
  '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 ' +
  '112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
  '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 ' +
  '214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
  '114131 311141 411131 211412 211214 211232 2331112'
).split(' ').map((s) => [...s].map(Number));

const START_B = 104;
const START_C = 105;
const STOP = 106;

// Code 39: n = narrow, w = wide, for the 9 alternating bars and spaces of each character.
const C39 = {
  0: 'nnnwwnwnn', 1: 'wnnwnnnnw', 2: 'nnwwnnnnw', 3: 'wnwwnnnnn', 4: 'nnnwwnnnw',
  5: 'wnnwwnnnn', 6: 'nnwwwnnnn', 7: 'nnnwnnwnw', 8: 'wnnwnnwnn', 9: 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn',
  F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn',
  P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn',
  $: 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn',
};

// Codabar: n = narrow, w = wide, for the 7 alternating bars and spaces of each character.
const CODABAR = {
  0: 'nnnnnww', 1: 'nnnnwwn', 2: 'nnnwnnw', 3: 'wwnnnnn', 4: 'nnwnnwn',
  5: 'wnnnnwn', 6: 'nwnnnnw', 7: 'nwnnwnn', 8: 'nwwnnnn', 9: 'wnnwnnn',
  '-': 'nnnwwnn', $: 'nnwwnnn', ':': 'wnnnwnw', '/': 'wnwnnnw', '.': 'wnwnwnn', '+': 'nnwnwnw',
  A: 'nnwwnwn', B: 'nwnwnnw', C: 'nnnwnww', D: 'nnnwwwn',
};

const WIDE = 3;

function code128(value) {
  let codes;
  let start;
  if (/^\d{4,}$/.test(value) && value.length % 2 === 0) {
    start = START_C;
    codes = value.match(/\d\d/g).map(Number);
  } else {
    start = START_B;
    codes = [...value].map((c) => {
      const n = c.charCodeAt(0);
      if (n < 32 || n > 126) throw new Error(`Code 128 can't include “${c}”.`);
      return n - 32;
    });
  }
  const sum = codes.reduce((acc, code, i) => acc + code * (i + 1), start);
  const symbols = [start, ...codes, sum % 103, STOP];
  return symbols.flatMap((s) => C128[s]);
}

// Characters drawn from a narrow/wide table, one narrow space between characters.
function fromTable(table, text) {
  const widths = [];
  [...text].forEach((c, i) => {
    const pattern = table[c];
    if (!pattern) throw new Error(`This barcode type can't include “${c}”.`);
    if (i) widths.push(1);
    for (const w of pattern) widths.push(w === 'w' ? WIDE : 1);
  });
  return widths;
}

function code39(value) {
  return fromTable(C39, `*${value.toUpperCase()}*`);
}

function codabar(value) {
  const text = value.toUpperCase();
  const framed = /^[ABCD].*[ABCD]$/.test(text) ? text : `A${text}A`;
  return fromTable(CODABAR, framed);
}

const ENCODERS = { code_128: code128, code_39: code39, codabar };

// A barcode type name from a scanner (any case, "code_128" or "CODE_128") as one we can draw, or null.
export function drawableFormat(name) {
  const key = String(name || '').toLowerCase().replace(/[\s-]/g, '_');
  return ENCODERS[key] ? key : null;
}

// Checks the value can be drawn in this format. Throws an Error with a plain message if not.
export function checkBarcode(format, value) {
  if (!ENCODERS[format]) throw new Error('This barcode type can\'t be drawn.');
  if (!value) throw new Error('Enter the number on the card.');
  ENCODERS[format](value);
}

// The barcode as an <svg> that fills the width it is given. Height comes from CSS.
export function barcodeSVG(format, value) {
  const widths = ENCODERS[format](value);
  const quiet = 10;
  const total = widths.reduce((a, b) => a + b, 0) + quiet * 2;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${total} 1`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Barcode ${value}`);
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('width', total);
  bg.setAttribute('height', 1);
  bg.setAttribute('fill', '#fff');
  svg.append(bg);
  let x = quiet;
  widths.forEach((w, i) => {
    if (i % 2 === 0) {
      const bar = document.createElementNS(NS, 'rect');
      bar.setAttribute('x', x);
      bar.setAttribute('width', w);
      bar.setAttribute('height', 1);
      bar.setAttribute('fill', '#000');
      svg.append(bar);
    }
    x += w;
  });
  return svg;
}
