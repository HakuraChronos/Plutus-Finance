/* ==========================================================================
   PLUTUS FINANCE - APPLICATION STATE MANAGEMENT (LOCAL-FIRST STORE)
   ========================================================================== */

import { auth } from './auth.js';
import { advanceDateKey, localDateKey, parseLocalDateKey } from './utils/dates.js';
import { CATEGORIES } from './models.js';
import { csvRecords } from './utils/csv.js';

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

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

export class StateStore {
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
  _createTransaction(tx) {
    const newTx = {
      id: makeId('tx'),
      date: tx.date || localDateKey(),
      type: tx.type, // 'income' | 'expense' | 'transfer'
      amount: parseFloat(tx.amount) || 0,
      categoryId: tx.categoryId,
      walletId: tx.walletId,
      toWalletId: tx.toWalletId || null,
      note: tx.note || '',
      createdAt: new Date().toISOString()
    };
    if (typeof tx.goalId === 'string' && tx.goalId) newTx.goalId = tx.goalId;
    if (typeof tx.billId === 'string' && tx.billId) newTx.billId = tx.billId;
    if (typeof tx.debtId === 'string' && tx.debtId) newTx.debtId = tx.debtId;

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
    return newTx;
  }

  addTransaction(tx) {
    const newTx = this._createTransaction(tx);
    this.save();
    return newTx;
  }

  updateTransaction(id, updates = {}) {
    const tx = this.state.transactions.find(item => item.id === id);
    if (!tx) return null;

    const newType = updates.type ?? tx.type;
    const newAmount = Number(updates.amount ?? tx.amount);
    const newWalletId = updates.walletId ?? tx.walletId;
    const newToWalletId = newType === 'transfer' ? (updates.toWalletId ?? tx.toWalletId) : null;
    const newDate = updates.date ?? tx.date;
    const newCategoryId = newType === 'transfer' ? null : (updates.categoryId !== undefined ? updates.categoryId : tx.categoryId);
    const newNote = updates.note !== undefined ? String(updates.note) : tx.note;

    if (!['income', 'expense', 'transfer'].includes(newType)) return null;
    if (!Number.isFinite(newAmount) || newAmount <= 0) return null;
    if (!parseLocalDateKey(newDate)) return null;

    const newWallet = this.state.wallets.find(w => w.id === newWalletId);
    if (!newWallet) return null;
    const newToWallet = newType === 'transfer' ? this.state.wallets.find(w => w.id === newToWalletId) : null;
    if (newType === 'transfer' && (!newToWallet || newToWalletId === newWalletId)) return null;

    // 1. Revert previous wallet balance effects
    const oldWallet = this.state.wallets.find(w => w.id === tx.walletId);
    if (oldWallet) {
      if (tx.type === 'expense') {
        oldWallet.balance += tx.amount;
      } else if (tx.type === 'income') {
        oldWallet.balance -= tx.amount;
      } else if (tx.type === 'transfer') {
        oldWallet.balance += tx.amount;
        const oldToWallet = this.state.wallets.find(w => w.id === tx.toWalletId);
        if (oldToWallet) {
          oldToWallet.balance -= tx.amount;
        }
      }
    }

    // 2. Apply updated wallet balance effects
    if (newType === 'expense') {
      newWallet.balance -= newAmount;
    } else if (newType === 'income') {
      newWallet.balance += newAmount;
    } else if (newType === 'transfer') {
      newWallet.balance -= newAmount;
      newToWallet.balance += newAmount;
    }

    const oldGoalId = tx.goalId;
    tx.type = newType;
    tx.amount = newAmount;
    tx.categoryId = newCategoryId;
    tx.walletId = newWalletId;
    tx.toWalletId = newToWalletId;
    tx.date = newDate;
    tx.note = newNote;
    if (newType !== 'expense' && tx.goalId) {
      delete tx.goalId;
    }

    if (oldGoalId) this.syncGoalBalance(oldGoalId);
    if (tx.goalId && tx.goalId !== oldGoalId) this.syncGoalBalance(tx.goalId);
    this.save();
    return tx;
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
    if (tx.goalId) this.syncGoalBalance(tx.goalId);
    this.save();
    return true;
  }

  // ==========================================
  // WALLET CRUD
  // ==========================================
  addWallet(w) {
    const newWallet = {
      id: makeId('w'),
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

  getWalletDependencies(id) {
    const referencesWallet = item => item.walletId === id || item.toWalletId === id;
    const transfers = this.state.transactions.filter(item => item.type === 'transfer' && referencesWallet(item));
    const transactions = this.state.transactions.filter(item => item.type !== 'transfer' && referencesWallet(item));
    const bills = this.state.bills.filter(item => item.walletId === id);
    const debts = this.state.debts.filter(item => item.walletId === id);

    return {
      transactions,
      transfers,
      bills,
      debts,
      total: transactions.length + transfers.length + bills.length + debts.length
    };
  }

  deleteWallet(id) {
    const index = this.state.wallets.findIndex(wallet => wallet.id === id);
    const dependencies = this.getWalletDependencies(id);
    if (index === -1) return { deleted: false, reason: 'not_found', dependencies };
    if (dependencies.total > 0) return { deleted: false, reason: 'dependencies', dependencies };

    this.state.wallets.splice(index, 1);
    this.save();
    return { deleted: true, reason: null, dependencies };
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
        id: makeId('b'),
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

  setPlanningSettings({ needs, wants, savings, spendingAlertPercent }) {
    const values = [needs, wants, savings].map(Number);
    if (values.some(value => !Number.isFinite(value) || value < 0) || Math.abs(values.reduce((a, b) => a + b, 0) - 100) > 0.001) {
      throw new Error('Allocation percentages must be non-negative and total 100%.');
    }
    this.state.settings.allocationTargets = { needs: values[0], wants: values[1], savings: values[2] };
    this.state.settings.spendingAlertPercent = Math.min(100, Math.max(1, Number(spendingAlertPercent) || 85));
    this.save();
  }

  addBill(bill) {
    const item = {
      id: 'bill_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: String(bill.name || '').trim(),
      amount: Math.max(0, Number(bill.amount) || 0),
      nextDue: bill.nextDue || localDateKey(),
      frequency: bill.frequency === 'yearly' ? 'yearly' : 'monthly',
      categoryId: bill.categoryId || 'cat_utilities',
      walletId: bill.walletId || '',
      active: true
    };
    if (!item.name || item.amount <= 0 || !parseLocalDateKey(item.nextDue)) throw new Error('Bill name, amount, and a valid due date are required.');
    if (!this.state.wallets.some(wallet => wallet.id === item.walletId)) throw new Error('Select a valid account for this bill.');
    this.state.bills.push(item);
    this.save();
    return item;
  }

  payBill(id) {
    const bill = this.state.bills.find(item => item.id === id);
    if (!bill || !this.state.wallets.some(wallet => wallet.id === bill.walletId)) return false;
    bill.nextDue = advanceDateKey(bill.nextDue, bill.frequency) || bill.nextDue;
    this.addTransaction({ type: 'expense', amount: bill.amount, categoryId: bill.categoryId, walletId: bill.walletId, billId: bill.id, date: localDateKey(), note: `Bill: ${bill.name}` });
    return true;
  }

  deleteBill(id) {
    this.state.bills = this.state.bills.filter(item => item.id !== id);
    this.save();
  }

  updateBill(id, updates = {}) {
    const bill = this.state.bills.find(item => item.id === id);
    if (!bill) return null;
    const name = String(updates.name ?? bill.name).trim();
    const amount = Number(updates.amount ?? bill.amount);
    const nextDue = updates.nextDue ?? bill.nextDue;
    const frequency = (updates.frequency ?? bill.frequency) === 'yearly' ? 'yearly' : 'monthly';
    const categoryId = updates.categoryId ?? bill.categoryId;
    const walletId = updates.walletId ?? bill.walletId;
    if (!name || !Number.isFinite(amount) || amount <= 0 || !parseLocalDateKey(nextDue)) {
      throw new Error('Bill name, amount, and a valid due date are required.');
    }
    if (!this.state.wallets.some(wallet => wallet.id === walletId)) {
      throw new Error('Select a valid account for this bill.');
    }
    Object.assign(bill, { name, amount, nextDue, frequency, categoryId, walletId });
    this.save();
    return bill;
  }

  addDebt(debt) {
    const item = {
      id: 'debt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: String(debt.name || '').trim(),
      kind: debt.kind === 'receivable' ? 'receivable' : 'owed',
      balance: Math.max(0, Number(debt.balance) || 0),
      interestRate: Math.max(0, Number(debt.interestRate) || 0),
      minimumPayment: Math.max(0, Number(debt.minimumPayment) || 0),
      nextDue: debt.nextDue || localDateKey(),
      walletId: debt.walletId || '',
      active: true
    };
    if (!item.name || item.balance <= 0 || !parseLocalDateKey(item.nextDue)) throw new Error('Debt name, balance, and a valid due date are required.');
    if (!this.state.wallets.some(wallet => wallet.id === item.walletId)) throw new Error('Select a valid linked account.');
    this.state.debts.push(item);
    this.save();
    return item;
  }

  recordDebtPayment(id, amount) {
    const debt = this.state.debts.find(item => item.id === id);
    const payment = Math.min(Math.max(0, Number(amount) || 0), debt?.balance || 0);
    if (!debt || !this.state.wallets.some(wallet => wallet.id === debt.walletId) || payment <= 0) return false;
    debt.balance = Math.max(0, debt.balance - payment);
    debt.active = debt.balance > 0;
    debt.nextDue = advanceDateKey(debt.nextDue, 'monthly') || debt.nextDue;
    this.addTransaction({
      type: debt.kind === 'receivable' ? 'income' : 'expense',
      amount: payment,
      categoryId: debt.kind === 'receivable' ? 'cat_other_income' : 'cat_debt_repay',
      walletId: debt.walletId,
      debtId: debt.id,
      date: localDateKey(),
      note: `${debt.kind === 'receivable' ? 'Received repayment' : 'Debt payment'}: ${debt.name}`
    });
    return true;
  }

  deleteDebt(id) {
    this.state.debts = this.state.debts.filter(item => item.id !== id);
    this.save();
  }

  updateDebt(id, updates = {}) {
    const debt = this.state.debts.find(item => item.id === id);
    if (!debt) return null;
    const name = String(updates.name ?? debt.name).trim();
    const kind = (updates.kind ?? debt.kind) === 'receivable' ? 'receivable' : 'owed';
    const balance = Number(updates.balance ?? debt.balance);
    const interestRate = Math.max(0, Number(updates.interestRate ?? debt.interestRate) || 0);
    const minimumPayment = Math.max(0, Number(updates.minimumPayment ?? debt.minimumPayment) || 0);
    const nextDue = updates.nextDue ?? debt.nextDue;
    const walletId = updates.walletId ?? debt.walletId;
    if (!name || !Number.isFinite(balance) || balance < 0 || !parseLocalDateKey(nextDue)) {
      throw new Error('Debt name, valid balance, and due date are required.');
    }
    if (!this.state.wallets.some(wallet => wallet.id === walletId)) {
      throw new Error('Select a valid linked account.');
    }
    Object.assign(debt, {
      name,
      kind,
      balance,
      interestRate,
      minimumPayment,
      nextDue,
      walletId,
      active: balance > 0
    });
    this.save();
    return debt;
  }

  // ==========================================
  // GOALS CRUD & DEPOSIT
  // ==========================================
  hasGoalStartingAmount(goal) {
    return Boolean(goal) && typeof goal.startingAmount === 'number' && Number.isFinite(goal.startingAmount);
  }

  goalStartingAmount(goal) {
    if (this.hasGoalStartingAmount(goal)) return goal.startingAmount;
    const legacyAmount = Number(goal?.currentAmount);
    return Number.isFinite(legacyAmount) ? legacyAmount : 0;
  }

  calculateGoalBalance(goal, transactions = this.state.transactions) {
    if (!goal) return null;
    if (!this.hasGoalStartingAmount(goal)) {
      return this.goalStartingAmount(goal);
    }

    const seen = new Set();
    const deposits = transactions.reduce((total, transaction) => {
      if (transaction.goalId !== goal.id || transaction.type !== 'expense') return total;
      const id = typeof transaction.id === 'string' ? transaction.id : '';
      const amount = Number(transaction.amount);
      if (!id || seen.has(id) || !Number.isFinite(amount) || amount <= 0) return total;
      seen.add(id);
      return total + amount;
    }, 0);
    return this.goalStartingAmount(goal) + deposits;
  }

  getGoalBalance(goalOrId) {
    const goal = typeof goalOrId === 'string'
      ? this.state.goals.find(item => item.id === goalOrId)
      : goalOrId;
    return this.calculateGoalBalance(goal);
  }

  syncGoalBalance(goalId) {
    const goal = this.state.goals.find(item => item.id === goalId);
    if (!this.hasGoalStartingAmount(goal)) return false;
    goal.currentAmount = this.calculateGoalBalance(goal);
    return true;
  }

  addGoal(g) {
    const startingAmount = parseFloat(g.currentAmount) || 0;
    const newGoal = {
      id: makeId('g'),
      title: g.title,
      targetAmount: parseFloat(g.targetAmount) || 0,
      startingAmount,
      currentAmount: startingAmount,
      deadline: g.deadline || advanceDateKey(localDateKey(), 'yearly'),
      icon: g.icon || '🎯',
      color: g.color || '#22c55e'
    };
    this.state.goals.push(newGoal);
    this.save();
    return newGoal;
  }

  updateGoal(id, updates = {}) {
    const goal = this.state.goals.find(item => item.id === id);
    if (!goal) return null;
    const title = String(updates.title ?? goal.title).trim();
    const targetAmount = Number(updates.targetAmount ?? goal.targetAmount);
    const deadline = updates.deadline ?? goal.deadline;
    const icon = updates.icon ?? goal.icon;
    if (!title || !Number.isFinite(targetAmount) || targetAmount <= 0 || !parseLocalDateKey(deadline)) {
      return null;
    }
    goal.title = title;
    goal.targetAmount = targetAmount;
    goal.deadline = deadline;
    goal.icon = icon;
    if (updates.startingAmount !== undefined && Number.isFinite(Number(updates.startingAmount)) && Number(updates.startingAmount) >= 0) {
      goal.startingAmount = Number(updates.startingAmount);
      this.syncGoalBalance(goal.id);
    } else if (!this.hasGoalStartingAmount(goal) && updates.currentAmount !== undefined && Number.isFinite(Number(updates.currentAmount)) && Number(updates.currentAmount) >= 0) {
      goal.currentAmount = Number(updates.currentAmount);
    }
    this.save();
    return goal;
  }

  depositGoal(goalId, amount, fromWalletId) {
    const goal = this.state.goals.find(g => g.id === goalId);
    const depAmount = parseFloat(amount) || 0;
    const wallet = this.state.wallets.find(item => item.id === fromWalletId);
    if (!goal || !wallet || depAmount <= 0 || !Number.isFinite(depAmount)) return false;

    if (!this.hasGoalStartingAmount(goal)) {
      goal.startingAmount = this.goalStartingAmount(goal);
    }

    // Record as expense transaction towards savings
    this._createTransaction({
      type: 'expense',
      amount: depAmount,
      categoryId: 'cat_savings_deposit',
      walletId: fromWalletId,
      goalId,
      date: localDateKey(),
      note: `Deposit to goal: ${goal.title}`
    });

    this.syncGoalBalance(goalId);
    this.save();
    return true;
  }

  updateGoalDepositAmount(transactionId, amount) {
    const transaction = this.state.transactions.find(item => item.id === transactionId);
    const newAmount = Number(amount);
    const goal = transaction?.goalId ? this.state.goals.find(item => item.id === transaction.goalId) : null;
    const wallet = transaction ? this.state.wallets.find(item => item.id === transaction.walletId) : null;
    if (!transaction || transaction.type !== 'expense' || !goal || !wallet || !Number.isFinite(newAmount) || newAmount <= 0) return false;

    const oldAmount = Number(transaction.amount);
    if (!Number.isFinite(oldAmount) || oldAmount <= 0) return false;
    wallet.balance -= newAmount - oldAmount;
    transaction.amount = newAmount;
    this.syncGoalBalance(goal.id);
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

  exportCSV() {
    const csvCell = value => {
      let text = String(value ?? '');
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Date,Type,Category,Amount,Currency,Account,Note\n";
    this.state.transactions.forEach(t => {
      const category = CATEGORIES.find(item => item.id === t.categoryId)?.name || t.categoryId || '';
      const account = this.state.wallets.find(item => item.id === t.walletId)?.name || t.walletId || '';
      const row = [t.date, t.type, category, this.fromBaseAmount(t.amount), this.currentCurrency.code, account, t.note].map(csvCell).join(',');
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

  importCSV(text) {
    const records = csvRecords(text);
    const imported = [];
    const errors = [];
    records.forEach((record, index) => {
      const type = record.type.toLowerCase();
      const amount = Number(record.amount);
      const account = this.state.wallets.find(item => item.id === record.account || item.name.toLowerCase() === record.account.toLowerCase());
      const category = CATEGORIES.find(item => item.id === record.category || item.name.toLowerCase() === String(record.category).toLowerCase());
      if (!parseLocalDateKey(record.date) || !['income', 'expense'].includes(type) || !Number.isFinite(amount) || amount <= 0 || !account) {
        errors.push(index + 2);
        return;
      }
      const sourceCurrency = CURRENCIES[String(record.currency || '').toUpperCase()] || this.currentCurrency;
      const baseAmount = amount / sourceCurrency.rate;
      const transaction = {
        id: 'tx_import_' + Date.now() + '_' + index + '_' + Math.random().toString(36).slice(2, 6),
        date: record.date,
        type,
        amount: baseAmount,
        categoryId: category?.id || (type === 'income' ? 'cat_other_income' : 'cat_shopping'),
        walletId: account.id,
        toWalletId: null,
        note: record.note || 'Imported transaction',
        createdAt: new Date().toISOString()
      };
      account.balance += type === 'income' ? baseAmount : -baseAmount;
      imported.push(transaction);
    });
    if (!imported.length) throw new Error(`No valid transactions found${errors.length ? `; check row(s) ${errors.join(', ')}` : ''}.`);
    this.state.transactions.unshift(...imported);
    this.save();
    return { imported: imported.length, skipped: errors.length, errorRows: errors };
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

  validateDataset(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Vault data is invalid.');
    if (JSON.stringify(value).length > 1_500_000) throw new Error('Vault exceeds the safe size limit.');
    const isObjectArray = arr => Array.isArray(arr) && arr.length <= 50000 && arr.every(item => item && typeof item === 'object' && !Array.isArray(item));
    const requiredArrays = ['wallets', 'transactions', 'budgets', 'goals'];
    if (!requiredArrays.every(key => isObjectArray(value[key]))) {
      throw new Error('Vault collections are missing or exceed safe limits.');
    }
    const optionalCollection = key => {
      if (value[key] === undefined || value[key] === null) return [];
      if (!isObjectArray(value[key])) throw new Error('Vault collections are missing or exceed safe limits.');
      return value[key];
    };

    const ensureFiniteNumber = (num, fallback = 0, allowNegative = false) => {
      if (num === undefined || num === null) return fallback;
      if (typeof num === 'boolean' || (typeof num === 'string' && num.trim() === '')) {
        throw new Error('Vault record contains an invalid numeric value.');
      }
      const parsed = Number(num);
      if (!Number.isFinite(parsed) || (!allowNegative && parsed < 0)) {
        throw new Error('Vault record contains an invalid numeric value.');
      }
      return parsed;
    };

    const walletIds = new Set();
    const wallets = value.wallets.map(wallet => {
      if (typeof wallet.id !== 'string' || !wallet.id.trim()) throw new Error('Account record is missing a valid ID.');
      if (walletIds.has(wallet.id)) throw new Error('Duplicate account ID detected in vault.');
      walletIds.add(wallet.id);
      const normalized = { ...wallet, balance: ensureFiniteNumber(wallet.balance, 0, true) };
      if (wallet.initialBalance !== undefined) normalized.initialBalance = ensureFiniteNumber(wallet.initialBalance, 0, true);
      if (wallet.creditLimit !== undefined) normalized.creditLimit = ensureFiniteNumber(wallet.creditLimit, 0, false);
      return normalized;
    });

    const transactions = value.transactions.map(tx => {
      if (typeof tx.id !== 'string' || !tx.id.trim()) throw new Error('Transaction record is missing a valid ID.');
      if (tx.type !== undefined && !['income', 'expense', 'transfer'].includes(tx.type)) {
        throw new Error('Transaction record has an invalid type.');
      }
      if (tx.date !== undefined && !parseLocalDateKey(tx.date)) {
        throw new Error('Transaction record has an invalid date.');
      }
      const amount = ensureFiniteNumber(tx.amount, 0, false);
      return { ...tx, amount };
    });

    const budgetIds = new Set();
    const budgets = value.budgets.map(budget => {
      if (budget.id !== undefined) {
        if (typeof budget.id !== 'string' || !budget.id.trim()) throw new Error('Budget record has an invalid ID.');
        if (budgetIds.has(budget.id)) throw new Error('Duplicate budget ID detected in vault.');
        budgetIds.add(budget.id);
      }
      if (typeof budget.categoryId !== 'string' || !budget.categoryId.trim()) {
        throw new Error('Budget record is missing a valid categoryId.');
      }
      return { ...budget, limit: ensureFiniteNumber(budget.limit, 0, false) };
    });

    const goalIds = new Set();
    const goals = value.goals.map(goal => {
      if (typeof goal.id !== 'string' || !goal.id.trim()) throw new Error('Goal record is missing a valid ID.');
      if (goalIds.has(goal.id)) throw new Error('Duplicate goal ID detected in vault.');
      goalIds.add(goal.id);
      if (goal.deadline !== undefined && !parseLocalDateKey(goal.deadline)) {
        throw new Error('Goal record has an invalid deadline date.');
      }
      const normalized = {
        ...goal,
        targetAmount: ensureFiniteNumber(goal.targetAmount, 0, false),
        currentAmount: ensureFiniteNumber(goal.currentAmount, 0, false)
      };
      if (Object.hasOwn(goal, 'startingAmount') && goal.startingAmount !== undefined) {
        normalized.startingAmount = ensureFiniteNumber(goal.startingAmount, 0, false);
      }
      return normalized;
    });

    const billIds = new Set();
    const bills = optionalCollection('bills').map(bill => {
      if (typeof bill.id !== 'string' || !bill.id.trim()) throw new Error('Bill record is missing a valid ID.');
      if (billIds.has(bill.id)) throw new Error('Duplicate bill ID detected in vault.');
      billIds.add(bill.id);
      if (bill.nextDue !== undefined && !parseLocalDateKey(bill.nextDue)) {
        throw new Error('Bill record has an invalid due date.');
      }
      return { ...bill, amount: ensureFiniteNumber(bill.amount, 0, false) };
    });

    const debtIds = new Set();
    const debts = optionalCollection('debts').map(debt => {
      if (typeof debt.id !== 'string' || !debt.id.trim()) throw new Error('Debt record is missing a valid ID.');
      if (debtIds.has(debt.id)) throw new Error('Duplicate debt ID detected in vault.');
      debtIds.add(debt.id);
      if (debt.kind !== undefined && !['owed', 'receivable'].includes(debt.kind)) {
        throw new Error('Debt record has an invalid kind.');
      }
      if (debt.nextDue !== undefined && !parseLocalDateKey(debt.nextDue)) {
        throw new Error('Debt record has an invalid due date.');
      }
      const normalized = { ...debt, balance: ensureFiniteNumber(debt.balance, 0, false) };
      if (debt.interestRate !== undefined) normalized.interestRate = ensureFiniteNumber(debt.interestRate, 0, false);
      if (debt.minimumPayment !== undefined) normalized.minimumPayment = ensureFiniteNumber(debt.minimumPayment, 0, false);
      return normalized;
    });

    const settings = value.settings && typeof value.settings === 'object' ? value.settings : {};
    const targets = settings.allocationTargets || {};
    const targetValues = [Number(targets.needs), Number(targets.wants), Number(targets.savings)];
    const validTargets = targetValues.every(item => Number.isFinite(item) && item >= 0) && Math.abs(targetValues.reduce((a, b) => a + b, 0) - 100) < 0.001;
    const validated = {
      settings: {
        currency: CURRENCIES[settings.currency] ? settings.currency : 'TWD',
        stealthMode: Boolean(settings.stealthMode),
        theme: ['dark', 'light'].includes(settings.theme) ? settings.theme : 'dark',
        allocationTargets: validTargets ? { needs: targetValues[0], wants: targetValues[1], savings: targetValues[2] } : { needs: 50, wants: 30, savings: 20 },
        spendingAlertPercent: Math.min(100, Math.max(1, Number(settings.spendingAlertPercent) || 85))
      },
      wallets,
      transactions,
      budgets,
      goals,
      bills,
      debts
    };
    validated.goals.forEach(goal => {
      if (this.hasGoalStartingAmount(goal)) {
        goal.currentAmount = this.calculateGoalBalance(goal, validated.transactions);
      }
    });
    return validated;
  }
}

export const store = new StateStore();
