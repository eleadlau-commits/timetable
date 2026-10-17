import { Capacitor } from '@capacitor/core';
import { validateCard, type Card } from './model';
export interface CardStorage { readonly persistent: boolean; load(): Promise<Card | null>; save(card: Card): Promise<void>; remove(): Promise<void>; }
export class MemoryCardStorage implements CardStorage {
  readonly persistent = false; private card: Card | null = null;
  async load() { return this.card ? validateCard(this.card) : null; }
  async save(card: Card) { this.card = validateCard(card); }
  async remove() { this.card = null; }
}
export interface SecureCredentialDriver { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; remove(key: string): Promise<void>; }
export class NativeCardStorage implements CardStorage {
  readonly persistent = true;
  constructor(private driver: SecureCredentialDriver) {}
  async load() { const value = await this.driver.get('durham.campus-card.v1'); return value === null ? null : validateCard(JSON.parse(value)); }
  async save(card: Card) { await this.driver.set('durham.campus-card.v1', JSON.stringify(validateCard(card))); }
  async remove() { await this.driver.remove('durham.campus-card.v1'); }
}
const nativeDriver: SecureCredentialDriver = {
  async get(key) { const { SecureStorage } = await import('@aparajita/capacitor-secure-storage'); const value = await SecureStorage.get(key, false, false); if (value !== null && typeof value !== 'string') throw new Error('Invalid secure credential'); return value; },
  async set(key, value) { const { SecureStorage, KeychainAccess } = await import('@aparajita/capacitor-secure-storage'); await SecureStorage.set(key, value, false, false, KeychainAccess.whenUnlockedThisDeviceOnly); },
  async remove(key) { const { SecureStorage } = await import('@aparajita/capacitor-secure-storage'); await SecureStorage.remove(key, false); },
};
type EncryptedRecord = { key: CryptoKey; iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer };
// Development only: non-exportable AES key and ciphertext are local to this origin.
// Same-origin scripts can still use the key. This is not hardware-backed storage.
export class BrowserCardStorage implements CardStorage {
  readonly persistent = true;
  private async db(): Promise<IDBDatabase> {
    if (!globalThis.indexedDB) throw new Error('Browser credential storage unavailable');
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('campus-card-development', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('credentials');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('Cannot open credential storage')); request.onblocked = () => reject(new Error('Credential storage blocked'));
    });
  }
  private async access<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('credentials', mode);
      let request: IDBRequest<T>;
      try { request = operation(tx.objectStore('credentials')); }
      catch { tx.abort(); db.close(); reject(new Error('Credential storage operation failed')); return; }
      tx.oncomplete = () => { db.close(); resolve(request.result); };
      tx.onabort = tx.onerror = () => { db.close(); reject(new Error('Credential storage operation failed')); };
    });
  }
  async load() {
    const record = await this.access<EncryptedRecord | undefined>('readonly', s => s.get('card'));
    if (!record) return null;
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv }, record.key, record.ciphertext);
    return validateCard(JSON.parse(new TextDecoder().decode(plaintext)));
  }
  async save(card: Card) {
    if (!globalThis.crypto?.subtle) throw new Error('Encrypted browser storage needs a secure connection');
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(validateCard(card))));
    await this.access('readwrite', s => s.put({ key, iv, ciphertext }, 'card'));
  }
  async remove() { await this.access('readwrite', s => s.delete('card')); }
}
export const cardStorage: CardStorage = Capacitor.isNativePlatform() ? new NativeCardStorage(nativeDriver) : new BrowserCardStorage();
