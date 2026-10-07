/* PLUTUS FINANCE - authenticated, encrypted per-user vaults */

const LEGACY_STORAGE_KEY = 'plutus_finance_v2';
const REGISTRY_KEY = 'plutus_users_registry';
const VAULT_PREFIX = 'plutus_vault_';
const PBKDF2_ITERATIONS = 310000;

export function folderNameFor(username) {
  return String(username || '').trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, '_').slice(0, 64) || 'User';
}

export function vaultStorageKey(username) {
  return VAULT_PREFIX + folderNameFor(username).toLowerCase();
}

function bytesToB64(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function hashPin(pin, saltB64, iterations = PBKDF2_ITERATIONS) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: b64ToBytes(saltB64), iterations, hash: 'SHA-256' },
    material,
    256
  );
  return bytesToB64(bits);
}

export async function deriveVaultKey(pin, saltB64, iterations = PBKDF2_ITERATIONS) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64ToBytes(saltB64), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJson(data, key) {
  const iv = randomBytes(12);
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return { v: 1, alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations: PBKDF2_ITERATIONS, iv: bytesToB64(iv), cipher: bytesToB64(cipher) };
}

export async function decryptJson(payload, key) {
  if (!payload || payload.v !== 1 || payload.alg !== 'AES-GCM' || !payload.iv || !payload.cipher) {
    throw new Error('Unrecognized or unencrypted vault format.');
  }
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(payload.iv) },
    key,
    b64ToBytes(payload.cipher)
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

function readRegistry() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REGISTRY_KEY) || '{"users":[]}');
    return parsed && Array.isArray(parsed.users) ? parsed : { users: [] };
  } catch {
    return { users: [] };
  }
}

function writeRegistry(users) {
  // This cache intentionally contains no PIN verifier.
  localStorage.setItem(REGISTRY_KEY, JSON.stringify({ users }));
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      cache: 'no-store',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
  } catch {
    throw new Error('Secure local server is unavailable. Start it with: python server.py');
  }
  let body = {};
  try { body = await response.json(); } catch { /* handled below */ }
  if (!response.ok) throw new Error(body.error || `Secure storage request failed (${response.status}).`);
  return body;
}

class AuthService {
  constructor() {
    this.currentUser = null;
    this.vaultKey = null;
    this.sessionToken = null;
    this.needsServerSync = false;
  }

  get users() { return readRegistry().users; }

  findUser(username) {
    const wanted = folderNameFor(username).toLowerCase();
    return this.users.find(user => folderNameFor(user.username).toLowerCase() === wanted) || null;
  }

  async syncDiskRegistry() {
    const result = await api('/api/profiles');
    writeRegistry(result.users || []);
  }

  consumeLegacyDataset() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || 'null');
      if (parsed && Array.isArray(parsed.wallets)) {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return parsed;
      }
    } catch { /* invalid legacy cache is ignored */ }
    return null;
  }

  async createUser(username, pin) {
    const name = String(username || '').trim();
    if (!/^[A-Za-z][A-Za-z0-9._ -]{1,31}$/.test(name)) throw new Error('Use 2–32 characters: start with a letter, then letters, numbers, spaces, . _ -');
    if (!/^\d{6,12}$/.test(pin)) throw new Error('PIN must be 6 to 12 digits.');
    if (this.findUser(name)) throw new Error('That profile already exists. Sign in instead.');

    const salt = bytesToB64(randomBytes(16));
    const pinHash = await hashPin(pin, salt);
    const key = await deriveVaultKey(pin, salt);
    const dataset = this.consumeLegacyDataset() || this.getEmptyDataset();
    const vault = await encryptJson(dataset, key);
    const privateProfile = { username: name, folder: folderNameFor(name), salt, pinHash, iterations: PBKDF2_ITERATIONS, createdAt: new Date().toISOString() };
    const result = await api('/api/profiles', { method: 'POST', body: JSON.stringify({ profile: privateProfile, vault }) });
    writeRegistry([...this.users, result.profile]);
    this.sessionToken = result.token;
    localStorage.setItem(vaultStorageKey(name), JSON.stringify({ savedAt: Date.now(), vault }));
    return { profile: result.profile, key, dataset };
  }

  async setupPin(username, pin) {
    if (!/^\d{6,12}$/.test(pin)) throw new Error('PIN must be 6 to 12 digits.');
    const existing = this.findUser(username);
    if (!existing || !existing.needsPinSetup) throw new Error('Profile cannot be set up.');
    const salt = bytesToB64(randomBytes(16));
    const pinHash = await hashPin(pin, salt);
    const key = await deriveVaultKey(pin, salt);
    const dataset = this.consumeLegacyDataset() || this.getEmptyDataset();
    const vault = await encryptJson(dataset, key);
    const result = await api('/api/setup', { method: 'POST', body: JSON.stringify({ username, salt, pinHash, vault }) });
    this.sessionToken = result.token;
    await this.syncDiskRegistry();
    const migratedDataset = result.legacy && Array.isArray(result.legacy.wallets) ? result.legacy : dataset;
    const migratedVault = await encryptJson(migratedDataset, key);
    localStorage.setItem(vaultStorageKey(username), JSON.stringify({ savedAt: Date.now(), vault: migratedVault }));
    if (result.legacy) {
      await api('/api/vault', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.sessionToken}` },
        body: JSON.stringify({ vault: migratedVault })
      });
    }
    return { profile: result.profile, key, dataset: migratedDataset };
  }

  async unlock(username, pin) {
    const profile = this.findUser(username);
    if (!profile || profile.needsPinSetup || !profile.salt) throw new Error('Unknown profile or PIN setup is required.');
    if (!/^\d{4,12}$/.test(pin)) throw new Error('PIN must be 4 to 12 digits.');
    const iterations = Number(profile.iterations) || 100000;
    const pinHash = await hashPin(pin, profile.salt, iterations);
    const result = await api('/api/session', { method: 'POST', body: JSON.stringify({ username, pinHash }) });
    const key = await deriveVaultKey(pin, profile.salt, iterations);
    this.sessionToken = result.token;
    this.needsServerSync = false;
    const dataset = await this.readVault(result.profile, key, result.vault, result.vaultUpdatedAt);
    this.currentUser = result.profile;
    this.vaultKey = key;
    return { profile: result.profile, key, dataset };
  }

  async readVault(profile, key, serverVault, serverUpdatedAt = 0) {
    const localRaw = localStorage.getItem(vaultStorageKey(profile.username));
    let localCandidate = null;
    if (localRaw) {
      try {
        const parsed = JSON.parse(localRaw);
        localCandidate = parsed?.vault
          ? { vault: parsed.vault, savedAt: Number(parsed.savedAt) || 0 }
          : { vault: parsed, savedAt: 0 };
      } catch { /* malformed cache is ignored */ }
    }
    if (serverVault && (!localCandidate || Number(serverUpdatedAt) >= localCandidate.savedAt)) {
      try {
        return await decryptJson(serverVault, key);
      } catch {
        if (!localCandidate) throw new Error('The encrypted disk vault is damaged and no browser fallback is available.');
      }
    }
    if (localCandidate) {
      try {
        const recovered = await decryptJson(localCandidate.vault, key);
        this.needsServerSync = true;
        return recovered;
      } catch {
        if (!serverVault) throw new Error('The encrypted browser fallback is damaged.');
      }
    }
    if (serverVault) return decryptJson(serverVault, key);
    return this.getEmptyDataset();
  }

  async writeVault(profile, key, dataset) {
    if (!this.sessionToken) throw new Error('Secure session expired. Sign in again.');
    const vault = await encryptJson(dataset, key);
    this.needsServerSync = true;
    localStorage.setItem(vaultStorageKey(profile.username), JSON.stringify({ savedAt: Date.now(), vault }));
    await api('/api/vault', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${this.sessionToken}` },
      body: JSON.stringify({ vault })
    });
    this.needsServerSync = false;
    return vault;
  }

  async restoreEncrypted(payload) {
    if (!this.currentUser || !this.vaultKey) throw new Error('Unlock a vault first.');
    return decryptJson(payload, this.vaultKey);
  }

  async recoverLegacyVault(pin) {
    if (!this.sessionToken || !this.currentUser || !this.vaultKey) throw new Error('Unlock the current vault first.');
    if (!/^\d{4,12}$/.test(pin)) throw new Error('Enter the PIN used by the earlier vault.');
    const result = await api('/api/recovery/legacy', {
      headers: { Authorization: `Bearer ${this.sessionToken}` }
    });
    const iterations = Number(result.profile?.iterations) || 100000;
    const legacyKey = await deriveVaultKey(pin, result.profile?.salt, iterations);
    try {
      return await decryptJson(result.vault, legacyKey);
    } catch {
      throw new Error('The old PIN is incorrect or the recovered vault is damaged.');
    }
  }

  async legacyRecoveryAvailable() {
    if (!this.sessionToken) return false;
    try {
      const result = await api('/api/recovery/status', {
        headers: { Authorization: `Bearer ${this.sessionToken}` }
      });
      return Boolean(result.available);
    } catch {
      return false;
    }
  }

  async encryptedBackup(dataset) {
    if (!this.currentUser || !this.vaultKey) throw new Error('Unlock a vault first.');
    return encryptJson(dataset, this.vaultKey);
  }

  logout() {
    this.currentUser = null;
    this.vaultKey = null;
    this.sessionToken = null;
    this.needsServerSync = false;
  }

  getEmptyDataset() {
    return {
      settings: {
        currency: 'TWD',
        stealthMode: false,
        theme: 'dark',
        allocationTargets: { needs: 50, wants: 30, savings: 20 },
        spendingAlertPercent: 85
      },
      wallets: [],
      transactions: [],
      budgets: [],
      goals: [],
      bills: [],
      debts: []
    };
  }
}

export const auth = new AuthService();
