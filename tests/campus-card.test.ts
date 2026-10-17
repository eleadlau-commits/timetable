import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manualCard, scannedCard, validateCard } from '../src/campus-card/model';
import { MemoryCardStorage, NativeCardStorage } from '../src/campus-card/storage';
import { detectionMetadata } from '../src/campus-card/diagnostics';

const synthetic = () => scannedCard('001234567890', 'CODE_39');
test('ordinary alphanumeric Code 128 and Telepen Alpha are accepted without widening control variants', () => {
  for (const format of ['Code128', 'TelepenAlpha']) {
    assert.equal(scannedCard('SYNTHETIC-ABC123 /+', format).value, 'SYNTHETIC-ABC123 /+');
    assert.throws(() => scannedCard('SYNTHETIC\u001d123', format));
  }
  assert.throws(() => validateCard({ ...scannedCard('001234', 'Code128'), symbologyIdentifier: ']C1' }));
});
test('diagnostics distinguish decoder-only formats and redact unrecognised metadata', () => {
  assert.deepEqual(detectionMetadata('OtherBarcode', ']X0'), { format: 'OtherBarcode', variant: ']X0', canGenerate: false });
  assert.deepEqual(detectionMetadata('SYNTHETIC-PAYLOAD', 'SYNTHETIC-PAYLOAD'), { format: 'Unknown format', variant: 'Unknown variant', canGenerate: false });
});
test('scan keeps exact value, format and leading zeros', () => {
  assert.equal(synthetic().value, '001234567890');
  assert.equal(synthetic().format, 'Code39');
});
test('unsupported formats and controls are rejected', () => {
  for (const format of ['TELEPEN', 'QR_CODE', 'constructor']) assert.throws(() => scannedCard('001234', format));
  assert.equal(scannedCard('001234', 'Code128').format, 'Code128');
  assert.equal(scannedCard('001234', 'TelepenNumeric').format, 'TelepenNumeric');
  assert.throws(() => scannedCard('00123', 'TelepenNumeric'));
  assert.throws(() => scannedCard('001\u001d234', 'CODE_39'));
});
test('EAN checksum and ITF parity validated without inventing a campus length', () => {
  assert.equal(scannedCard('0012345678905', 'EAN_13').value, '0012345678905');
  assert.throws(() => scannedCard('0012345678906', 'EAN_13'));
  assert.throws(() => scannedCard('123', 'ITF'));
  assert.equal(scannedCard('0012', 'ITF').value, '0012');
});
test('manual entry uses the established Numeric profile and preserves leading zeros', () => {
  assert.throws(() => manualCard('00x12'), /only the digits/);
  assert.equal(manualCard('0012').value, '0012');
  assert.equal(manualCard('0012').format, 'TelepenNumeric');
  assert.throws(() => manualCard('123'), /even number/);
  assert.equal(manualCard(synthetic().value, synthetic()).value, '001234567890');
  assert.throws(() => manualCard('1234', synthetic()), /does not match/);
  assert.equal(manualCard('00123456789012', scannedCard('00998877665544', 'TelepenNumeric')).value, '00123456789012');
  assert.throws(() => manualCard(''), /only the digits/);
});
test('memory development store supports replacement, copies and deletion', async () => {
  const storage = new MemoryCardStorage();
  assert.equal(storage.persistent, false);
  assert.equal(await storage.load(), null);
  await storage.save(synthetic());
  const first = (await storage.load())!; first.value = 'MUTATED';
  assert.equal((await storage.load())!.value, '001234567890');
  await storage.save(scannedCard('009988', 'CODE_39'));
  assert.equal((await storage.load())!.value, '009988');
  await storage.remove(); assert.equal(await storage.load(), null);
});
test('native adapter persists through adapters and deletes driver credential', async () => {
  const values = new Map<string, string>();
  const driver = { async get(key: string) { return values.get(key) ?? null; }, async set(key: string, value: string) { values.set(key, value); }, async remove(key: string) { values.delete(key); } };
  const a = new NativeCardStorage(driver); await a.save(synthetic());
  const b = new NativeCardStorage(driver); assert.equal((await b.load())!.value, '001234567890');
  await b.remove(); assert.equal(values.size, 0);
});
test('storage failures propagate and malformed stored credentials rejected', async () => {
  const bad = new NativeCardStorage({ async get() { return '{}'; }, async set() { throw new Error('locked'); }, async remove() { throw new Error('locked'); } });
  await assert.rejects(() => bad.load()); await assert.rejects(() => bad.save(synthetic())); await assert.rejects(() => bad.remove());
  assert.throws(() => validateCard({ ...synthetic(), bytes: [1, 2, 3] }));
  assert.throws(() => validateCard({ ...synthetic(), symbologyIdentifier: ']C1' }));
});
