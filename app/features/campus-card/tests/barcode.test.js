import { test, assert } from 'folio/testing';
import { drawableFormat, checkBarcode, barcodeSVG } from '../barcode.js';

test('scanner format names are understood', () => {
  assert.equal(drawableFormat('CODE_128'), 'code_128');
  assert.equal(drawableFormat('code 39'), 'code_39');
  assert.equal(drawableFormat('codabar'), 'codabar');
  assert.equal(drawableFormat('qr_code'), null);
});

test('values that can be drawn pass the check', () => {
  checkBarcode('code_128', '12345678');
  checkBarcode('code_128', 'AB-12 x');
  checkBarcode('code_39', 'ABC123');
  checkBarcode('codabar', 'A123456B');
});

test('values that can\'t be drawn give a plain message', () => {
  assert.throws(() => checkBarcode('code_128', ''), /Enter the number/);
  assert.throws(() => checkBarcode('code_39', 'abc_def'), /can't include/);
  assert.throws(() => checkBarcode('codabar', '12#4'), /can't include/);
});

test('a barcode is drawn as bars', () => {
  const svg = barcodeSVG('code_128', '12345678');
  assert.equal(svg.tagName, 'svg');
  assert.ok(svg.querySelectorAll('rect').length > 10, 'expected many bars');
});

test('a vertical barcode runs top to bottom with the same bars', () => {
  const flat = barcodeSVG('code_128', '12345678');
  const tall = barcodeSVG('code_128', '12345678', { vertical: true });
  const [, , w, h] = flat.getAttribute('viewBox').split(' ').map(Number);
  assert.equal(tall.getAttribute('viewBox'), `0 0 ${h} ${w}`);
  const bars = (svg, at) => [...svg.querySelectorAll('rect')].map((r) => r.getAttribute(at));
  assert.deepEqual(bars(tall, 'y'), bars(flat, 'x'));
  assert.deepEqual(bars(tall, 'height'), bars(flat, 'width'));
});
