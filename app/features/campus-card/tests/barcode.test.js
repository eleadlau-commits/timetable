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
