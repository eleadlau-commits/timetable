export const formats = ['TelepenNumeric', 'TelepenAlpha', 'Code128', 'ITF', 'Code39', 'EAN13', 'EAN8'] as const;
export type Format = typeof formats[number];
export type Card = { version: 1; value: string; format: Format; bytes: number[]; symbologyIdentifier: string; source: 'scan' | 'photo' | 'manual'; savedAt: string };
export class CardValidationError extends Error {}
const aliases: Record<string, Format> = { CODE_39: 'Code39', CODE_128: 'Code128', EAN_13: 'EAN13', EAN_8: 'EAN8' };
const identifiers: Record<Format, string> = { TelepenNumeric: ']B1', TelepenAlpha: ']B0', Code128: ']C0', ITF: ']I0', Code39: ']A0', EAN13: ']E0', EAN8: ']E4' };
export function validateCard(input: unknown): Card {
  const c = input as Card;
  if (!c || c.version !== 1 || !['scan','photo','manual'].includes(c.source) || typeof c.value !== 'string' || !c.value.length || c.value.length > 512 || typeof c.savedAt !== 'string' || !Number.isFinite(Date.parse(c.savedAt))) throw new CardValidationError('Saved card is invalid or exceeds the supported size limit.');
  const format = aliases[c.format] ?? c.format;
  if (!formats.includes(format)) throw new CardValidationError('The decoder recognised this format, but the app only accepts its supported 1D card formats.');
  const patterns: Record<Format, RegExp> = { TelepenNumeric: /^(?:\d\d)+$/, TelepenAlpha: /^[\x20-\x7e]+$/, Code128: /^[\x20-\x7e]+$/, ITF: /^(?:\d\d)+$/, Code39: /^[0-9A-Z .$/+%\-]+$/, EAN13: /^\d{13}$/, EAN8: /^\d{8}$/ };
  if (!patterns[format].test(c.value)) throw new CardValidationError(format === 'ITF' || format === 'TelepenNumeric' ? 'This format requires digit pairs in the supported app subset.' : 'This barcode contains unsupported data or control characters.');
  if (format.startsWith('EAN')) {
    const digits = [...c.value].map(Number); const check = digits.pop()!;
    const sum = digits.reverse().reduce((s, n, i) => s + n * (i % 2 ? 1 : 3), 0);
    if ((10 - sum % 10) % 10 !== check) throw new CardValidationError('Invalid barcode checksum.');
  }
  const bytes = Array.from(new TextEncoder().encode(c.value));
  if (c.bytes && (c.bytes.length !== bytes.length || c.bytes.some((b, i) => b !== bytes[i]))) throw new CardValidationError('Decoded bytes do not match the supported text encoding.');
  const symbologyIdentifier = c.symbologyIdentifier ?? identifiers[format];
  if (symbologyIdentifier !== identifiers[format]) throw new CardValidationError('The AIM variant differs from the ordinary variant supported by the app; no conversion was attempted.');
  return { version: 1, value: c.value, format, bytes, symbologyIdentifier, source: c.source, savedAt: c.savedAt };
}
export function scannedCard(value: string, format: string): Card {
  return validateCard({ version: 1, value, format, source: 'scan', savedAt: new Date().toISOString() });
}
// Established from the supplied card's printed number and independently matched bars.
// Telepen Numeric encodes digit pairs; no university-wide fixed length is assumed.
export const durhamCardFormat: Format = 'TelepenNumeric';
export function manualCard(value: string, verified?: Card | null): Card {
  if (!/^\d+$/.test(value)) throw new Error('Enter only the digits printed underneath the barcode.');
  if (!verified || (verified.format === durhamCardFormat && value !== verified.value)) {
    if (value.length % 2 !== 0) throw new Error('This card format needs an even number of digits. Check the printed number.');
    return validateCard({ ...scannedCard(value, durhamCardFormat), source: 'manual' });
  }
  if (value !== verified.value) throw new Error('The number does not match the verified barcode. Check the digits or import a new photo.');
  return validateCard({ ...verified, value, source: 'manual', savedAt: new Date().toISOString() });
}
