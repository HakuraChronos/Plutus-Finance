import assert from 'node:assert/strict';
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key)
};

const { auth, deriveVaultKey, encryptJson, decryptJson, hashPin, legacyHashPin, vaultStorageKey } = await import('../app/js/auth.js');
const { StateStore } = await import('../app/js/state.js');

const profile = { username: 'PersistenceTest', folder: 'PersistenceTest' };
const salt = 'MDEyMzQ1Njc4OWFiY2RlZg==';
const key = await deriveVaultKey('123456', salt);
const v2PinHash = await hashPin('123456', salt);
const v1PinHash = await legacyHashPin('123456', salt);
assert.notEqual(v2PinHash, v1PinHash, 'PIN verifier must be domain-separated from raw PBKDF2 key bits');

// Importing the v2 verifier bytes as an AES key must NOT decrypt the vault
const verifierBytes = Uint8Array.from(atob(v2PinHash), c => c.charCodeAt(0));
const wrongKey = await crypto.subtle.importKey('raw', verifierBytes, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
const sampleVault = await encryptJson({ hello: 'world' }, key);
await assert.rejects(() => decryptJson(sampleVault, wrongKey), 'PIN verifier must not be usable as the AES vault key');
const dataset = marker => ({
  settings: { currency: 'TWD', stealthMode: false, theme: 'dark' },
  wallets: [{ id: marker }],
  transactions: [],
  budgets: [],
  goals: []
});

const serverVault = await encryptJson(dataset('server'), key);
const localVault = await encryptJson(dataset('local'), key);

localStorage.setItem(vaultStorageKey(profile.username), JSON.stringify({ savedAt: 100, vault: localVault }));
auth.needsServerSync = false;
let loaded = await auth.readVault(profile, key, serverVault, 200);
assert.equal(loaded.wallets[0].id, 'server', 'newer server vault must win');
assert.equal(auth.needsServerSync, false);

localStorage.setItem(vaultStorageKey(profile.username), JSON.stringify({ savedAt: 300, vault: localVault }));
auth.needsServerSync = false;
loaded = await auth.readVault(profile, key, serverVault, 200);
assert.equal(loaded.wallets[0].id, 'local', 'newer interrupted local save must win');
assert.equal(auth.needsServerSync, true, 'newer local fallback must be resynchronized');

const testStore = new StateStore();
testStore.save = () => {};
const w1 = testStore.addWallet({ name: 'A', balance: 10 });
const w2 = testStore.addWallet({ name: 'B', balance: 20 });
assert.notEqual(w1.id, w2.id, 'rapid wallet creation must not collide on Date.now()');

assert.throws(() => testStore.validateDataset({
  wallets: [{ id: 'w1', balance: 'not-a-number' }],
  transactions: [], budgets: [], goals: []
}), /invalid numeric value/);

assert.throws(() => testStore.validateDataset({
  wallets: [{ id: 'dup', balance: 0 }, { id: 'dup', balance: 10 }],
  transactions: [], budgets: [], goals: []
}), /Duplicate account ID/);

assert.throws(() => testStore.validateDataset({
  wallets: [],
  transactions: [{ id: 'tx1', type: 'expense', amount: -50 }],
  budgets: [], goals: []
}), /invalid numeric value/);

assert.throws(() => testStore.validateDataset({
  wallets: [],
  transactions: [{ id: 'tx1', type: 'expense', amount: 50, date: '2026-99-99' }],
  budgets: [], goals: []
}), /invalid date/);

console.log('Client fallback selection and resynchronization: PASS');
