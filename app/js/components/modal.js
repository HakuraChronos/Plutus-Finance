/* ==========================================================================
   PLUTUS FINANCE - DYNAMIC MODALS SYSTEM (MINIMALIST / ENGLISH)
   ========================================================================== */

import { store } from '../state.js';
import { CATEGORIES, WALLET_TYPES, CATEGORY_TYPES } from '../models.js';
import { toast } from './toast.js';
import { escapeHtml } from '../utils/security.js';
import { localDateKey, localMonthKey } from '../utils/dates.js';

class ModalManager {
  constructor() {
    this.overlay = null;
    this.dialog = null;
    this.init();
  }

  init() {
    let el = document.getElementById('global-modal-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'global-modal-overlay';
      el.className = 'modal-overlay';
      el.innerHTML = `
        <div class="modal-dialog" id="global-modal-dialog"></div>
      `;
      document.body.appendChild(el);

      el.addEventListener('click', (e) => {
        if (e.target === el) this.close();
      });
    }
    this.overlay = el;
    this.dialog = document.getElementById('global-modal-dialog');
  }

  close() {
    if (this.overlay) {
      this.overlay.classList.remove('show');
    }
  }

  open(htmlContent) {
    if (!this.overlay) this.init();
    this.dialog.innerHTML = htmlContent;
    this.overlay.classList.add('show');

    // Attach close button events
    const closeBtns = this.dialog.querySelectorAll('[data-action="close-modal"]');
    closeBtns.forEach(btn => btn.addEventListener('click', () => this.close()));
  }

  // ==========================================
  // MODAL: RECORD TRANSACTION
  // ==========================================
  showAddTransactionModal(defaultType = 'expense') {
    const wallets = store.state.wallets;
    const today = localDateKey();
    const curr = store.currentCurrency;

    // Currency-specific quick amounts
    const quickAmounts = curr.code === 'TWD'
      ? [100, 500, 1000, 2000, 5000, 10000]
      : [10, 25, 50, 100, 250, 500];

    const hasWallets = wallets.length > 0;

    const html = `
      <div class="modal-header">
        <h3 class="modal-title">Record Transaction</h3>
        <button class="modal-close-btn" data-action="close-modal" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body">
        ${!hasWallets ? `
          <div style="background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.2); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 16px; font-size: 0.82rem; color: var(--amber-500); display: flex; flex-direction: column; gap: 8px;">
            <span>You have no accounts or wallets yet. Please create one to link this transaction.</span>
            <button type="button" class="btn btn-sm btn-primary" id="btn-prompt-add-wallet" style="align-self: flex-start;">+ Add Account First</button>
          </div>
        ` : ''}

        <form id="form-add-tx">
          <!-- Type selector: Expense / Income / Transfer -->
          <div style="display: flex; gap: 6px; margin-bottom: 16px;">
            <button type="button" class="btn btn-sm ${defaultType === 'expense' ? 'btn-danger' : 'btn-secondary'}" id="btn-type-expense" style="flex: 1;">Expense</button>
            <button type="button" class="btn btn-sm ${defaultType === 'income' ? 'btn-primary' : 'btn-secondary'}" id="btn-type-income" style="flex: 1;">Income</button>
            <button type="button" class="btn btn-sm ${defaultType === 'transfer' ? 'btn-accent' : 'btn-secondary'}" id="btn-type-transfer" style="flex: 1;">Transfer</button>
          </div>
          <input type="hidden" id="tx-type" value="${defaultType}">

          <div class="form-group">
            <label class="form-label">Amount (${curr.code})</label>
            <input type="number" id="tx-amount" class="form-input" placeholder="0" min="0.01" step="any" required autofocus style="font-size: 1.25rem; font-weight: 700;">
            <div style="display: flex; gap: 5px; margin-top: 6px; flex-wrap: wrap;">
              ${quickAmounts.map(val => `
                <button type="button" class="btn btn-sm btn-secondary quick-amt" data-val="${val}">+${curr.symbol}${val >= 1000 ? (val/1000) + 'k' : val}</button>
              `).join('')}
            </div>
          </div>

          <div class="form-group" id="group-category">
            <label class="form-label">Category</label>
            <select id="tx-category" class="form-select">
              ${this.renderCategoryOptions(defaultType)}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" id="label-wallet">Account / Wallet</label>
              <select id="tx-wallet" class="form-select" required>
                ${hasWallets
                  ? wallets.map(w => `<option value="${escapeHtml(w.id)}">${escapeHtml(w.icon)} ${escapeHtml(w.name)} (${store.formatMoney(w.balance)})</option>`).join('')
                  : '<option value="">No accounts available</option>'}
              </select>
            </div>

            <div class="form-group" id="group-to-wallet" style="display: ${defaultType === 'transfer' ? 'flex' : 'none'};">
              <label class="form-label">Destination Account</label>
              <select id="tx-to-wallet" class="form-select">
                ${wallets.map(w => `<option value="${escapeHtml(w.id)}">${escapeHtml(w.icon)} ${escapeHtml(w.name)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group" id="group-date">
              <label class="form-label">Date</label>
              <input type="date" id="tx-date" class="form-input" value="${today}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Note / Description</label>
            <input type="text" id="tx-note" class="form-input" placeholder="e.g. Lunch with coworkers, groceries, monthly salary...">
          </div>

          <div class="modal-footer" style="margin: 16px -20px -20px; padding: 14px 20px;">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-submit-tx" ${!hasWallets ? 'disabled' : ''}>Save Transaction</button>
          </div>
        </form>
      </div>
    `;

    this.open(html);

    const btnPromptAddWallet = document.getElementById('btn-prompt-add-wallet');
    if (btnPromptAddWallet) {
      btnPromptAddWallet.addEventListener('click', () => {
        this.showAddWalletModal();
      });
    }

    const btnExp = document.getElementById('btn-type-expense');
    const btnInc = document.getElementById('btn-type-income');
    const btnTrf = document.getElementById('btn-type-transfer');
    const typeInput = document.getElementById('tx-type');
    const catSelect = document.getElementById('tx-category');
    const catGroup = document.getElementById('group-category');
    const toWalletGroup = document.getElementById('group-to-wallet');
    const walletLabel = document.getElementById('label-wallet');

    const setType = (newType) => {
      typeInput.value = newType;
      btnExp.className = `btn btn-sm ${newType === 'expense' ? 'btn-danger' : 'btn-secondary'}`;
      btnInc.className = `btn btn-sm ${newType === 'income' ? 'btn-primary' : 'btn-secondary'}`;
      btnTrf.className = `btn btn-sm ${newType === 'transfer' ? 'btn-accent' : 'btn-secondary'}`;

      if (newType === 'transfer') {
        catGroup.style.display = 'none';
        toWalletGroup.style.display = 'flex';
        walletLabel.innerText = 'From Account';
      } else {
        catGroup.style.display = 'flex';
        toWalletGroup.style.display = 'none';
        walletLabel.innerText = 'Account / Wallet';
        catSelect.innerHTML = this.renderCategoryOptions(newType);
      }
    };

    btnExp.addEventListener('click', () => setType('expense'));
    btnInc.addEventListener('click', () => setType('income'));
    btnTrf.addEventListener('click', () => setType('transfer'));

    // Quick amount chip click
    const amtInput = document.getElementById('tx-amount');
    document.querySelectorAll('.quick-amt').forEach(b => {
      b.addEventListener('click', () => {
        const add = parseFloat(b.getAttribute('data-val'));
        const current = parseFloat(amtInput.value) || 0;
        amtInput.value = current + add;
      });
    });

    // Handle Form Submit
    const form = document.getElementById('form-add-tx');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const type = typeInput.value;
      const rawAmount = parseFloat(amtInput.value);
      const categoryId = catSelect ? catSelect.value : null;
      const walletId = document.getElementById('tx-wallet').value;
      const toWalletId = document.getElementById('tx-to-wallet').value;
      const date = document.getElementById('tx-date').value;
      const note = document.getElementById('tx-note').value;

      if (!rawAmount || rawAmount <= 0) {
        toast.error('Please enter a valid amount.');
        return;
      }

      if (!walletId) {
        toast.error('Please select an account.');
        return;
      }

      if (type === 'transfer' && walletId === toWalletId) {
        toast.error('Source and destination accounts must be different.');
        return;
      }

      // Convert to base currency
      const baseAmount = store.toBaseAmount(rawAmount);

      store.addTransaction({
        type,
        amount: baseAmount,
        categoryId: type === 'transfer' ? null : categoryId,
        walletId,
        toWalletId: type === 'transfer' ? toWalletId : null,
        date,
        note
      });

      this.close();
      toast.success('Transaction recorded successfully.');

      if (type === 'expense' && categoryId) {
        this.checkBudgetWarning(categoryId);
      }
    });
  }

  renderCategoryOptions(type) {
    const list = CATEGORIES.filter(c => c.type === (type === 'income' ? CATEGORY_TYPES.INCOME : CATEGORY_TYPES.EXPENSE));
    return list.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  }

  checkBudgetWarning(categoryId) {
    const budget = store.state.budgets.find(b => b.categoryId === categoryId);
    if (!budget) return;

    const currentMonth = localMonthKey();
    const spent = store.state.transactions
      .filter(t => t.type === 'expense' && t.categoryId === categoryId && t.date.startsWith(currentMonth))
      .reduce((acc, t) => acc + t.amount, 0);

    const cat = CATEGORIES.find(c => c.id === categoryId);
    const percent = Math.round((spent / budget.limit) * 100);

    if (percent >= 100) {
      toast.warning(`Budget Alert: You have exceeded 100% of your budget for "${cat?.name}".`);
    } else if (percent >= 85) {
      toast.warning(`Caution: You have used ${percent}% of your monthly budget for "${cat?.name}".`);
    }
  }

  // ==========================================
  // MODAL: ADD NEW ACCOUNT / WALLET
  // ==========================================
  showAddWalletModal() {
    const curr = store.currentCurrency;
    const html = `
      <div class="modal-header">
        <h3 class="modal-title">Add New Account</h3>
        <button class="modal-close-btn" data-action="close-modal" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body">
        <form id="form-add-wallet">
          <div class="form-group">
            <label class="form-label">Account Name</label>
            <input type="text" id="w-name" class="form-input" placeholder="e.g. Taiwan Bank Main, Cash Wallet, Chase..." required autofocus>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Account Type</label>
              <select id="w-type" class="form-select">
                <option value="bank">🏛️ Bank Account</option>
                <option value="cash">💵 Cash</option>
                <option value="credit">💳 Credit Card</option>
                <option value="ewallet">📱 Digital Wallet</option>
                <option value="savings">🏦 Savings & Investment</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Icon</label>
              <select id="w-icon" class="form-select">
                <option value="🏛️">🏛️ Bank</option>
                <option value="💵">💵 Cash</option>
                <option value="💳">💳 Credit Card</option>
                <option value="📱">📱 Digital</option>
                <option value="🏦">🏦 Savings</option>
                <option value="📈">📈 Investment</option>
                <option value="🪙">🪙 Currency</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Initial Balance (${curr.code})</label>
              <input type="number" id="w-balance" class="form-input" placeholder="0" value="0" step="any">
            </div>

            <div class="form-group" id="group-credit-limit" style="display: none;">
              <label class="form-label">Credit Limit (${curr.code})</label>
              <input type="number" id="w-credit-limit" class="form-input" placeholder="0" value="0" step="any">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Account / Card Number (Optional)</label>
            <input type="text" id="w-acc-num" class="form-input" placeholder="e.g. 1903... or ****1234">
          </div>

          <div class="modal-footer" style="margin: 16px -20px -20px; padding: 14px 20px;">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Account</button>
          </div>
        </form>
      </div>
    `;

    this.open(html);

    const typeSelect = document.getElementById('w-type');
    const creditGroup = document.getElementById('group-credit-limit');
    typeSelect.addEventListener('change', () => {
      creditGroup.style.display = typeSelect.value === 'credit' ? 'block' : 'none';
    });

    document.getElementById('form-add-wallet').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('w-name').value.trim();
      const type = typeSelect.value;
      const rawBalance = parseFloat(document.getElementById('w-balance').value) || 0;
      const rawCreditLimit = parseFloat(document.getElementById('w-credit-limit').value) || 0;
      const accountNumber = document.getElementById('w-acc-num').value.trim();
      const icon = document.getElementById('w-icon').value;

      if (!name) return;

      const balance = store.toBaseAmount(rawBalance);
      const creditLimit = store.toBaseAmount(rawCreditLimit);

      store.addWallet({
        name,
        type,
        balance,
        creditLimit,
        accountNumber,
        icon
      });

      this.close();
      toast.success(`Account "${name}" created.`);
    });
  }

  // ==========================================
  // MODAL: SET CATEGORY BUDGET
  // ==========================================
  showAddBudgetModal() {
    const expenseCategories = CATEGORIES.filter(c => c.type === CATEGORY_TYPES.EXPENSE);
    const curr = store.currentCurrency;

    const html = `
      <div class="modal-header">
        <h3 class="modal-title">Set Monthly Budget</h3>
        <button class="modal-close-btn" data-action="close-modal" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body">
        <form id="form-add-budget">
          <div class="form-group">
            <label class="form-label">Expense Category</label>
            <select id="b-category" class="form-select">
              ${expenseCategories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Monthly Spending Limit (${curr.code})</label>
            <input type="number" id="b-limit" class="form-input" placeholder="e.g. 5000" min="1" step="any" required autofocus>
            <span class="form-hint">Your safe daily spending allowance will be computed automatically.</span>
          </div>

          <div class="modal-footer" style="margin: 16px -20px -20px; padding: 14px 20px;">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Budget</button>
          </div>
        </form>
      </div>
    `;

    this.open(html);

    document.getElementById('form-add-budget').addEventListener('submit', (e) => {
      e.preventDefault();
      const categoryId = document.getElementById('b-category').value;
      const rawLimit = parseFloat(document.getElementById('b-limit').value) || 0;

      if (rawLimit <= 0) {
        toast.error('Limit must be greater than zero.');
        return;
      }

      const limit = store.toBaseAmount(rawLimit);
      store.addBudget({ categoryId, limit });
      this.close();
      toast.success('Budget limit saved.');
    });
  }

  // ==========================================
  // MODAL: CREATE SAVINGS GOAL
  // ==========================================
  showAddGoalModal() {
    const curr = store.currentCurrency;
    const html = `
      <div class="modal-header">
        <h3 class="modal-title">Create Savings Goal</h3>
        <button class="modal-close-btn" data-action="close-modal" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body">
        <form id="form-add-goal">
          <div class="form-group">
            <label class="form-label">Goal Title</label>
            <input type="text" id="g-title" class="form-input" placeholder="e.g. Emergency Fund, Japan Trip, New Laptop..." required autofocus>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Target Amount (${curr.code})</label>
              <input type="number" id="g-target" class="form-input" placeholder="50000" min="1" step="any" required>
            </div>

            <div class="form-group">
              <label class="form-label">Starting Saved (${curr.code})</label>
              <input type="number" id="g-current" class="form-input" placeholder="0" value="0" step="any">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Target Completion Date</label>
              <input type="date" id="g-deadline" class="form-input" value="2026-12-31" required>
            </div>

            <div class="form-group">
              <label class="form-label">Icon</label>
              <select id="g-icon" class="form-select">
                <option value="🎯">🎯 Milestone</option>
                <option value="🛡️">🛡️ Emergency Fund</option>
                <option value="🚗">🚗 Vehicle</option>
                <option value="🏠">🏠 House</option>
                <option value="✈️">✈️ Travel</option>
                <option value="💻">💻 Tech Device</option>
                <option value="🎓">🎓 Education</option>
              </select>
            </div>
          </div>

          <div class="modal-footer" style="margin: 16px -20px -20px; padding: 14px 20px;">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Goal</button>
          </div>
        </form>
      </div>
    `;

    this.open(html);

    document.getElementById('form-add-goal').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('g-title').value.trim();
      const rawTarget = parseFloat(document.getElementById('g-target').value) || 0;
      const rawCurrent = parseFloat(document.getElementById('g-current').value) || 0;
      const deadline = document.getElementById('g-deadline').value;
      const icon = document.getElementById('g-icon').value;

      if (!title || rawTarget <= 0) {
        toast.error('Please enter a goal name and valid target amount.');
        return;
      }

      const targetAmount = store.toBaseAmount(rawTarget);
      const currentAmount = store.toBaseAmount(rawCurrent);

      store.addGoal({ title, targetAmount, currentAmount, deadline, icon });
      this.close();
      toast.success(`Savings goal "${title}" created.`);
    });
  }

  // ==========================================
  // MODAL: DEPOSIT INTO GOAL
  // ==========================================
  showDepositGoalModal(goalId) {
    const goal = store.state.goals.find(g => g.id === goalId);
    if (!goal) return;
    const wallets = store.state.wallets;
    const curr = store.currentCurrency;

    const remaining = Math.max(0, goal.targetAmount - store.getGoalBalance(goal));

    const html = `
      <div class="modal-header">
        <h3 class="modal-title">Deposit to: ${escapeHtml(goal.title)}</h3>
        <button class="modal-close-btn" data-action="close-modal" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body">
        <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 14px;">
          Remaining to reach target: <strong>${store.formatMoney(remaining)}</strong>
        </p>

        <form id="form-deposit-goal">
          <div class="form-group">
            <label class="form-label">Deposit Amount (${curr.code})</label>
            <input type="number" id="dep-amount" class="form-input" placeholder="0" min="1" step="any" required autofocus>
          </div>

          <div class="form-group">
            <label class="form-label">Deduct From Account</label>
            <select id="dep-wallet" class="form-select" required>
              ${wallets.map(w => `<option value="${escapeHtml(w.id)}">${escapeHtml(w.icon)} ${escapeHtml(w.name)} (${store.formatMoney(w.balance)})</option>`).join('')}
            </select>
          </div>

          <div class="modal-footer" style="margin: 16px -20px -20px; padding: 14px 20px;">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Confirm Deposit</button>
          </div>
        </form>
      </div>
    `;

    this.open(html);

    document.getElementById('form-deposit-goal').addEventListener('submit', (e) => {
      e.preventDefault();
      const rawAmount = parseFloat(document.getElementById('dep-amount').value) || 0;
      const walletId = document.getElementById('dep-wallet').value;

      if (rawAmount <= 0) {
        toast.error('Deposit amount must be greater than zero.');
        return;
      }

      const amount = store.toBaseAmount(rawAmount);
      const ok = store.depositGoal(goalId, amount, walletId);
      if (ok) {
        this.close();
        toast.success(`Deposited ${store.formatMoney(amount)} into "${goal.title}".`);
      } else {
        toast.error('The savings goal or linked account is no longer available.');
      }
    });
  }
}

export const modal = new ModalManager();
