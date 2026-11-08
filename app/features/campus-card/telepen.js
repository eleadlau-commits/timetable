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
  return readTelepenRuns(runsOf((i) => row.get(i), row.getSize()));
}

// The same, from a line already split into dark and light runs ({ dark, length }; lengths can
// be fractions of a pixel, see scan.js).
export function readTelepenRuns(runs) {
  return fromRuns(runs) || fromRuns([...runs].reverse());
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
      if (unit < 0.6) return null; // too small to be a real barcode
      if (s > 0 && runs[s - 1].length < unit * 4) return null; // no white space before
    }
    const char = readChar(runs, i, unit, codes.length ? undefined : START);
    if (!char) return null;
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

// One character from runs[i]: the character whose bars and spaces (each 1 or 3 units, 16 in all)
// fit the runs best. Blur makes thin bars look thicker and thick ones thinner, so rather than
// sorting each run into thin or thick on its own, every character is tried and the closest
// wins (the first character must be the start, so only that is tried there). The last part is a space, which may run on into white space after the barcode: then
// only what the character needs is counted, and `after` says how much white space was left.
function readChar(runs, i, unit, only) {
  if (!runs[i]?.dark) return null;
  let best = null;
  for (const [code, widths] of only === undefined ? CHARS.entries() : [[only, CHARS[only]]]) {
    const n = widths.length;
    if (i + n > runs.length) continue;
    const last = runs[i + n - 1];
    // The character's size: from its first bar to the next character's first bar, unless the
    // last space runs on into white space (then from the parts before it).
    let before = 0;
    for (let k = 0; k < n - 1; k++) before += runs[i + k].length;
    const runsOn = last.length > (before / (16 - widths[n - 1])) * (widths[n - 1] + 2);
    const u = runsOn ? before / (16 - widths[n - 1]) : (before + last.length) / 16;
    if (u < unit * 0.8 || u > unit * 1.25) continue; // characters are all the same size
    // Mostly judged by a bar and the space after it together (and a space and the bar after
    // it): blur makes bars wider and spaces narrower by the same amount, so their sums stay
    // right. The single widths count a little too, to tell otherwise equal patterns apart.
    let error = 0;
    const width = (k) => (k === n - 1 && runsOn ? widths[k] : runs[i + k].length / u);
    for (let k = 0; k < n && error !== Infinity; k++) {
      const one = Math.abs(width(k) - widths[k]);
      const two = k + 1 < n ? Math.abs(width(k) + width(k + 1) - widths[k] - widths[k + 1]) : 0;
      if (one > 1.5 || two > 1) error = Infinity;
      else error += two * two + one * one / 4;
    }
    if (error === Infinity || (best && error >= best.error)) continue;
    best = { code, error, size: u * 16, next: i + n, after: runsOn ? last.length - widths[n - 1] * u : 0 };
  }
  return best;
}
