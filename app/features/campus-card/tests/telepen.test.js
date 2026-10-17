import { test, assert } from 'folio/testing';
import { charWidths, checkChar, numberCodes, digitsOf, telepenWidths, readTelepen } from '../telepen.js';
import { findTelepen } from '../scan.js';
import { barcodeSVG, checkBarcode, drawableFormat } from '../barcode.js';

// A row (getSize(), get(i): true = dark) from [dark, pixels] parts.
function row(...parts) {
  const bits = parts.flatMap(([dark, n]) => Array(Math.round(n)).fill(dark));
  return { getSize: () => bits.length, get: (i) => bits[i] };
}
const bars = (widths, unit = 4) => widths.map((w, i) => [i % 2 === 0, w * unit]);
const WHITE = [false, 60];
const DARK = [true, 150];

test('characters are drawn as the Telepen standard says', () => {
  assert.equal(charWidths(95).join(''), '111111111133'); // "_", the start
  assert.equal(charWidths(0).join(''), '31313131');
  assert.equal(charWidths(1).join(''), '1131313111');
  assert.equal(charWidths(2).join(''), '33313111');
  assert.equal(charWidths(6).join(''), '13133131');
  assert.equal(charWidths(14).join(''), '1311133111');
  for (let code = 0; code < 128; code++) {
    const widths = charWidths(code);
    assert.equal(widths.reduce((a, b) => a + b, 0), 16, `character ${code} should be 16 units`);
  }
});

test('every character looks different', () => {
  const seen = new Set();
  for (let code = 0; code < 128; code++) seen.add(charWidths(code).join(''));
  assert.equal(seen.size, 128);
});

test('number mode: two digits per character, a last odd digit on its own', () => {
  assert.deepEqual(numberCodes('000199'), [27, 28, 126]);
  assert.deepEqual(numberCodes('12345'), [39, 61, 22]);
  assert.equal(digitsOf([27, 28, 126]), '000199');
  assert.equal(digitsOf([39, 61, 22]), '12345');
  assert.equal(digitsOf([10]), null);
});

test('the check character makes the total a multiple of 127', () => {
  const codes = numberCodes('12345678901234');
  assert.equal((codes.reduce((a, b) => a + b, 0) + checkChar(codes)) % 127, 0);
  assert.equal(checkChar([127]), 0);
});

test('a number-mode barcode is read back, with dark areas around it', () => {
  const found = readTelepen(row(DARK, WHITE, ...bars(telepenWidths('12345678901234', { numeric: true })), WHITE, DARK));
  assert.deepEqual([found?.numeric, found?.value], [true, '12345678901234']);
  const odd = readTelepen(row(WHITE, ...bars(telepenWidths('1234567', { numeric: true }), 3), WHITE));
  assert.equal(odd?.value, '1234567');
});

test('backwards (an upside-down card) reads the same', () => {
  const widths = telepenWidths('12345678901234', { numeric: true });
  assert.equal(readTelepen(row(WHITE, ...bars(widths).reverse(), WHITE))?.value, '12345678901234');
});

test('text mode: a barcode is shown as digits when it could be digits, but redrawn with the same bars', () => {
  // The bars can't say whether they hold digits or text. Library cards use digits, so digits
  // win; either way the barcode drawn again is exactly the same, so scanners read the same.
  const widths = telepenWidths('Lib 42!');
  const found = readTelepen(row(WHITE, ...bars(widths), WHITE));
  assert.deepEqual(found?.codes, [...'Lib 42!'].map((c) => c.charCodeAt(0)));
  const redrawn = found.numeric ? telepenWidths(found.value, { numeric: true }) : telepenWidths(found.value);
  assert.deepEqual(redrawn, widths);
  const text = readTelepen(row(WHITE, ...bars(telepenWidths('\u0007AB')), WHITE));
  assert.deepEqual([text?.numeric, text?.value], [false, '\u0007AB']); // can't be digits
});

test('bars printed a little thicker than the spaces are still read', () => {
  const inky = telepenWidths('20260101', { numeric: true }).map((w, i) => [i % 2 === 0, w * 5 + (i % 2 === 0 ? 2 : -2)]);
  assert.equal(readTelepen(row(WHITE, ...inky, WHITE))?.value, '20260101');
});

test('a wrong check character, a missing stop or no white space means no barcode', () => {
  const widths = telepenWidths('1234', { numeric: true });
  const start = widths.slice(0, 12);
  const data = numberCodes('1234').flatMap(charWidths);
  const stop = charWidths(122);
  assert.equal(readTelepen(row(WHITE, ...bars([...start, ...data, ...charWidths(5), ...stop]), WHITE)), null);
  assert.equal(readTelepen(row(WHITE, ...bars(widths.slice(0, -16)), WHITE)), null);
  assert.equal(readTelepen(row(DARK, ...bars(widths), WHITE)), null);
  assert.equal(readTelepen(row(WHITE, DARK, WHITE)), null);
});

test('Telepen can be typed in and drawn', () => {
  assert.equal(drawableFormat('telepen_numeric'), 'telepen_numeric');
  checkBarcode('telepen_numeric', '12345678901234');
  checkBarcode('telepen', 'AB 12');
  assert.throws(() => checkBarcode('telepen_numeric', '12AB'), /only hold digits/);
  assert.ok(barcodeSVG('telepen_numeric', '12345678901234').querySelectorAll('rect').length > 20);
});

// A picture of a card on a grey table, with uneven light, as ImageData.
function photo(widths, { unit = 4, sideways = false } = {}) {
  const canvas = document.createElement('canvas');
  const length = widths.reduce((a, b) => a + b, 0) * unit;
  canvas.width = length + 400;
  canvas.height = 500;
  const g = canvas.getContext('2d');
  const shade = g.createLinearGradient(0, 0, canvas.width, 0);
  shade.addColorStop(0, '#555');
  shade.addColorStop(1, '#999');
  g.fillStyle = shade;
  g.fillRect(0, 0, canvas.width, 500);
  g.fillStyle = '#eee';
  g.fillRect(120, 100, length + 160, 300);
  g.fillStyle = '#222';
  let x = 200;
  widths.forEach((w, i) => {
    if (i % 2 === 0) g.fillRect(x, 180, w * unit, 140);
    x += w * unit;
  });
  if (!sideways) return g.getImageData(0, 0, canvas.width, 500);
  const turned = document.createElement('canvas');
  turned.width = 500;
  turned.height = canvas.width;
  const t = turned.getContext('2d');
  t.translate(500, 0);
  t.rotate(Math.PI / 2);
  t.drawImage(canvas, 0, 0);
  return t.getImageData(0, 0, 500, canvas.width);
}

test('a Telepen barcode is found in a picture, straight or sideways', () => {
  const widths = telepenWidths('98765432109876', { numeric: true });
  assert.equal(findTelepen(photo(widths))?.value, '98765432109876');
  assert.equal(findTelepen(photo(widths, { sideways: true }))?.value, '98765432109876');
});

test('a picture without a barcode finds nothing', () => {
  assert.equal(findTelepen(photo([])), null);
});
