import assert from 'node:assert/strict';
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key)
};

const { auth, deriveVaultKey, encryptJson, vaultStorageKey } = await import('../app/js/auth.js');

const profile = { username: 'PersistenceTest', folder: 'PersistenceTest' };
const key = await deriveVaultKey('123456', 'MDEyMzQ1Njc4OWFiY2RlZg==');
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

console.log('Client fallback selection and resynchronization: PASS');
