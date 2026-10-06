/* ==========================================================================
   PLUTUS FINANCE - APPLICATION STATE MANAGEMENT (LOCAL-FIRST STORE)
   ========================================================================== */

import { auth } from './auth.js';
import { localDateKey } from './utils/dates.js';

export const CURRENCIES = {
  TWD: {
    code: 'TWD',
    name: 'New Taiwan Dollar',
    symbol: 'NT$',
    rate: 1, // Base currency
    decimals: 0,
    position: 'prefix'
  },
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    rate: 0.03125, // 1 USD ≈ 32 TWD
    decimals: 2,
    position: 'prefix'
  }
};

class StateStore {
  constructor() {
    this.listeners = [];
    this.state = this.getEmptyDataset();
    this.locked = true;
    this.persistChain = Promise.resolve();
    this.pendingSaves = 0;
  }

  async attachSession(profile, key, dataset) {
    this.locked = false;
    this.state = this.validateDataset(dataset);
    auth.currentUser = profile;
    auth.vaultKey = key;
    if (auth.needsServerSync) await this.persistVault(this.state);
    this.notify();
  }

  lock() {
    this.locked = true;
    this.state = this.getEmptyDataset();
    auth.logout();
    this.notify();
  }

  async persistVault(snapshot = this.state) {
    if (this.locked || !auth.currentUser || !auth.vaultKey) return;
    try {
      await auth.writeVault(auth.currentUser, auth.vaultKey, snapshot);
    } catch (e) {
      console.error('Error saving user vault:', e);
      window.dispatchEvent(new CustomEvent('plutus:save-error', { detail: e.message || 'Vault save failed.' }));
      throw e;
    }
  }

  save() {
    if (this.locked) return;
    const snapshot = JSON.parse(JSON.stringify(this.state));
    let saveSucceeded = false;
    this.pendingSaves += 1;
    window.dispatchEvent(new CustomEvent('plutus:save-status', { detail: 'saving' }));
    this.persistChain = this.persistChain
      .catch(() => {})
      .then(async () => {
        await this.persistVault(snapshot);
        saveSucceeded = true;
      })
      .finally(() => {
        this.pendingSaves = Math.max(0, this.pendingSaves - 1);
        if (this.pendingSaves === 0) {
          window.dispatchEvent(new CustomEvent('plutus:save-status', { detail: saveSucceeded ? 'saved' : 'error' }));
        }
      });
    this.notify();
  }

  async flush() {
    await this.persistChain.catch(() => {});
  }

  get hasPendingSaves() {
    return this.pendingSaves > 0;
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => {
      try {
        fn(this.state);
      } catch (err) {
        console.error('Error in state listener:', err);
      }
    });
  }

  // ==========================================
  // CURRENCY & FORMATTING
  // ==========================================
  get currentCurrency() {
    const code = this.state.settings?.currency || 'TWD';
    return CURRENCIES[code] || CURRENCIES.TWD;
  }

  setCurrency(currencyCode) {
    if (CURRENCIES[currencyCode]) {
      this.state.settings.currency = currencyCode;
      this.save();
    }
  }

  formatMoney(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return 'NT$ 0';
    const curr = this.currentCurrency;
    const converted = amount * curr.rate;

    const formatted = new Intl.NumberFormat(curr.code === 'TWD' ? 'en-US' : 'en-US', {
      minimumFractionDigits: curr.decimals,
      maximumFractionDigits: curr.decimals
    }).format(converted);

    return `${curr.symbol} ${formatted}`;
  }

  toBaseAmount(inputAmount) {
    const curr = this.currentCurrency;
    return (parseFloat(inputAmount) || 0) / curr.rate;
  }

  fromBaseAmount(baseAmount) {
    const curr = this.currentCurrency;
    return (parseFloat(baseAmount) || 0) * curr.rate;
  }

  // ==========================================
  // PRIVACY / STEALTH MODE
  // ==========================================
  get stealthMode() {
    return !!this.state.settings?.stealthMode;
  }

  toggleStealthMode() {
    this.state.settings.stealthMode = !this.state.settings.stealthMode;
    this.save();
    return this.state.settings.stealthMode;
  }

  // ==========================================
  // TRANSACTION CRUD WITH AUTO WALLET SYNC
  // ==========================================
  addTransaction(tx) {
    const newTx = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      date: tx.date || localDateKey(),
      type: tx.type, // 'income' | 'expense' | 'transfer'
      amount: parseFloat(tx.amount) || 0,
      categoryId: tx.categoryId,
      walletId: tx.walletId,
      toWalletId: tx.toWalletId || null,
      note: tx.note || '',
      createdAt: new Date().toISOString()
    };

    // Update wallet balance
    const wallet = this.state.wallets.find(w => w.id === newTx.walletId);
    if (wallet) {
      if (newTx.type === 'expense') {
        wallet.balance -= newTx.amount;
      } else if (newTx.type === 'income') {
        wallet.balance += newTx.amount;
      } else if (newTx.type === 'transfer') {
        wallet.balance -= newTx.amount;
        const toWallet = this.state.wallets.find(w => w.id === newTx.toWalletId);
        if (toWallet) {
          toWallet.balance += newTx.amount;
        }
      }
    }

    this.state.transactions.unshift(newTx);
    this.save();
    return newTx;
  }

  deleteTransaction(id) {
    const index = this.state.transactions.findIndex(t => t.id === id);
    if (index === -1) return false;
    const tx = this.state.transactions[index];

    // Revert wallet balance
    const wallet = this.state.wallets.find(w => w.id === tx.walletId);
    if (wallet) {
      if (tx.type === 'expense') {
        wallet.balance += tx.amount;
      } else if (tx.type === 'income') {
        wallet.balance -= tx.amount;
      } else if (tx.type === 'transfer') {
        wallet.balance += tx.amount;
        const toWallet = this.state.wallets.find(w => w.id === tx.toWalletId);
        if (toWallet) {
          toWallet.balance -= tx.amount;
        }
      }
    }

    this.state.transactions.splice(index, 1);
    this.save();
    return true;
  }

  // ==========================================
  // WALLET CRUD
  // ==========================================
  addWallet(w) {
    const newWallet = {
      id: 'w_' + Date.now(),
      name: w.name,
      type: w.type || 'bank',
      balance: parseFloat(w.balance) || 0,
      initialBalance: parseFloat(w.balance) || 0,
      creditLimit: parseFloat(w.creditLimit) || 0,
      accountNumber: w.accountNumber || '',
      icon: w.icon || '💳'
    };
    this.state.wallets.push(newWallet);
    this.save();
    return newWallet;
  }

  updateWallet(id, updates) {
    const wallet = this.state.wallets.find(w => w.id === id);
    if (!wallet) return null;
    Object.assign(wallet, updates);
    this.save();
    return wallet;
  }

  deleteWallet(id) {
    this.state.wallets = this.state.wallets.filter(w => w.id !== id);
    this.save();
  }

  // ==========================================
  // BUDGET CRUD
  // ==========================================
  addBudget(b) {
    const existing = this.state.budgets.find(item => item.categoryId === b.categoryId);
    if (existing) {
      existing.limit = parseFloat(b.limit);
    } else {
      this.state.budgets.push({
        id: 'b_' + Date.now(),
        categoryId: b.categoryId,
        limit: parseFloat(b.limit) || 0,
        period: 'monthly'
      });
    }
    this.save();
  }

  deleteBudget(id) {
    this.state.budgets = this.state.budgets.filter(b => b.id !== id);
    this.save();
  }

  // ==========================================
  // GOALS CRUD & DEPOSIT
  // ==========================================
  addGoal(g) {
    const newGoal = {
      id: 'g_' + Date.now(),
      title: g.title,
      targetAmount: parseFloat(g.targetAmount) || 0,
      currentAmount: parseFloat(g.currentAmount) || 0,
      deadline: g.deadline || '2026-12-31',
      icon: g.icon || '🎯',
      color: g.color || '#22c55e'
    };
    this.state.goals.push(newGoal);
    this.save();
    return newGoal;
  }

  depositGoal(goalId, amount, fromWalletId) {
    const goal = this.state.goals.find(g => g.id === goalId);
    if (!goal) return false;
    const depAmount = parseFloat(amount) || 0;
    if (depAmount <= 0) return false;

    goal.currentAmount += depAmount;

    // Record as expense transaction towards savings
    this.addTransaction({
      type: 'expense',
      amount: depAmount,
      categoryId: 'cat_savings_deposit',
      walletId: fromWalletId,
      date: localDateKey(),
      note: `Deposit to goal: ${goal.title}`
    });

    this.save();
    return true;
  }

  deleteGoal(id) {
    this.state.goals = this.state.goals.filter(g => g.id !== id);
    this.save();
  }

  // ==========================================
  // BACKUP / EXPORT / IMPORT
  // ==========================================
  async exportJSON() {
    const encrypted = await auth.encryptedBackup(this.state);
    const blob = new Blob([JSON.stringify(encrypted, null, 2)], { type: 'application/json' });
    const dataUrl = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataUrl);
    downloadAnchor.setAttribute('download', `plutus_encrypted_backup_${localDateKey()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(dataUrl);
  }

  async importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      const restored = await auth.restoreEncrypted(parsed);
      const validated = this.validateDataset(restored);
      await auth.writeVault(auth.currentUser, auth.vaultKey, validated);
      this.state = validated;
      this.notify();
      return true;
    } catch (e) {
      console.error('Invalid JSON file:', e);
      throw new Error('This is not a valid backup for the currently unlocked profile.');
    }
  }

  async recoverLegacy(pin) {
    const recovered = await auth.recoverLegacyVault(pin);
    const validated = this.validateDataset(recovered);
    await auth.writeVault(auth.currentUser, auth.vaultKey, validated);
    this.state = validated;
    this.notify();
    return {
      wallets: validated.wallets.length,
      transactions: validated.transactions.length,
      budgets: validated.budgets.length,
      goals: validated.goals.length
    };
  }

  exportCSV() {
    const csvCell = value => {
      let text = String(value ?? '');
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "ID,Date,Type,Category,Amount,Account,Note\n";
    this.state.transactions.forEach(t => {
      const cat = t.categoryId || '';
      const row = [t.id, t.date, t.type, cat, t.amount, t.walletId, t.note].map(csvCell).join(',');
      csvContent += row + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `plutus_transactions_${localDateKey()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  clearAll() {
    this.state = this.getEmptyDataset();
    this.save();
  }

  // ==========================================
  // CLEAN EMPTY STATE (NO MOCK DATA)
  // ==========================================
  getEmptyDataset() {
    return {
      settings: {
        currency: 'TWD',
        stealthMode: false,
        theme: 'dark'
      },
      wallets: [],
      transactions: [],
      budgets: [],
      goals: []
    };
  }

  validateDataset(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Vault data is invalid.');
    if (JSON.stringify(value).length > 1_500_000) throw new Error('Vault exceeds the safe size limit.');
    const arrays = ['wallets', 'transactions', 'budgets', 'goals'];
    if (!arrays.every(key => Array.isArray(value[key]) && value[key].length <= 50000 && value[key].every(item => item && typeof item === 'object' && !Array.isArray(item)))) {
      throw new Error('Vault collections are missing or exceed safe limits.');
    }
    const settings = value.settings && typeof value.settings === 'object' ? value.settings : {};
    return {
      settings: {
        currency: CURRENCIES[settings.currency] ? settings.currency : 'TWD',
        stealthMode: Boolean(settings.stealthMode),
        theme: ['dark', 'light'].includes(settings.theme) ? settings.theme : 'dark'
      },
      wallets: value.wallets,
      transactions: value.transactions,
      budgets: value.budgets,
      goals: value.goals
    };
  }
}

export const store = new StateStore();
