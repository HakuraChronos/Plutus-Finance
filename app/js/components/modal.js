/* ==========================================================================
   PLUTUS FINANCE - DYNAMIC MODALS SYSTEM (MINIMALIST / ENGLISH)
   ========================================================================== */

import { store } from '../state.js';
import { CATEGORIES, WALLET_TYPES, CATEGORY_TYPES } from '../models.js';
import { toast } from './toast.js';
import { escapeHtml } from '../utils/security.js';
import { advanceDateKey, localDateKey, localMonthKey } from '../utils/dates.js';

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

  confirm({ title = 'Confirm Action', message = 'Are you sure you want to continue?', confirmText = 'Confirm', danger = true, onConfirm }) {
    const html = `
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(title)}</h3>
        <button class="modal-close-btn" data-action="close-modal" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body">
        <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 4px;">
          ${escapeHtml(message)}
        </p>
        <div class="modal-footer" style="margin: 18px -20px -20px; padding: 14px 20px;">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="btn-modal-confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    this.open(html);
    const confirmBtn = document.getElementById('btn-modal-confirm');
    if (confirmBtn) {
      confirmBtn.focus();
      confirmBtn.addEventListener('click', () => {
        this.close();
        if (typeof onConfirm === 'function') onConfirm();
      });
    }
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

  renderCategoryOptions(type, selectedId = null) {
    const list = CATEGORIES.filter(c => c.type === (type === 'income' ? CATEGORY_TYPES.INCOME : CATEGORY_TYPES.EXPENSE));
    return list.map(c => `<option value="${c.id}" ${selectedId === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('');
  }

  showEditTransactionModal(txId) {
    const tx = store.state.transactions.find(item => item.id === txId);
    if (!tx) return;
    const wallets = store.state.wallets;
    const curr = store.currentCurrency;
    const displayAmount = Number(store.fromBaseAmount(tx.amount).toFixed(curr.decimals));

    const html = `
      <div class="modal-header">
        <h3 class="modal-title">Edit Transaction</h3>
        <button class="modal-close-btn" data-action="close-modal" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body">
        <form id="form-edit-tx">
          <div style="display: flex; gap: 6px; margin-bottom: 16px;">
            <button type="button" class="btn btn-sm ${tx.type === 'expense' ? 'btn-danger' : 'btn-secondary'}" id="btn-edit-type-expense" style="flex: 1;">Expense</button>
            <button type="button" class="btn btn-sm ${tx.type === 'income' ? 'btn-primary' : 'btn-secondary'}" id="btn-edit-type-income" style="flex: 1;">Income</button>
            <button type="button" class="btn btn-sm ${tx.type === 'transfer' ? 'btn-accent' : 'btn-secondary'}" id="btn-edit-type-transfer" style="flex: 1;">Transfer</button>
          </div>
          <input type="hidden" id="edit-tx-type" value="${escapeHtml(tx.type)}">

          <div class="form-group">
            <label class="form-label">Amount (${curr.code})</label>
            <input type="number" id="edit-tx-amount" class="form-input" value="${displayAmount}" min="0.01" step="any" required autofocus style="font-size: 1.25rem; font-weight: 700;">
          </div>

          <div class="form-group" id="edit-group-category" style="display: ${tx.type === 'transfer' ? 'none' : 'flex'};">
            <label class="form-label">Category</label>
            <select id="edit-tx-category" class="form-select">
              ${this.renderCategoryOptions(tx.type === 'income' ? 'income' : 'expense', tx.categoryId)}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" id="edit-label-wallet">${tx.type === 'transfer' ? 'From Account' : 'Account / Wallet'}</label>
              <select id="edit-tx-wallet" class="form-select" required>
                ${wallets.map(w => `<option value="${escapeHtml(w.id)}" ${w.id === tx.walletId ? 'selected' : ''}>${escapeHtml(w.icon)} ${escapeHtml(w.name)} (${store.formatMoney(w.balance)})</option>`).join('')}
              </select>
            </div>

            <div class="form-group" id="edit-group-to-wallet" style="display: ${tx.type === 'transfer' ? 'flex' : 'none'};">
              <label class="form-label">Destination Account</label>
              <select id="edit-tx-to-wallet" class="form-select">
                ${wallets.map(w => `<option value="${escapeHtml(w.id)}" ${w.id === tx.toWalletId ? 'selected' : ''}>${escapeHtml(w.icon)} ${escapeHtml(w.name)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Date</label>
              <input type="date" id="edit-tx-date" class="form-input" value="${escapeHtml(tx.date)}" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Note / Description</label>
            <input type="text" id="edit-tx-note" class="form-input" value="${escapeHtml(tx.note || '')}" placeholder="Description...">
          </div>

          <div class="modal-footer" style="margin: 16px -20px -20px; padding: 14px 20px;">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;

    this.open(html);

    const btnExp = document.getElementById('btn-edit-type-expense');
    const btnInc = document.getElementById('btn-edit-type-income');
    const btnTrf = document.getElementById('btn-edit-type-transfer');
    const typeInput = document.getElementById('edit-tx-type');
    const catSelect = document.getElementById('edit-tx-category');
    const catGroup = document.getElementById('edit-group-category');
    const toWalletGroup = document.getElementById('edit-group-to-wallet');
    const walletLabel = document.getElementById('edit-label-wallet');

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
        catSelect.innerHTML = this.renderCategoryOptions(newType, tx.categoryId);
      }
    };

    btnExp.addEventListener('click', () => setType('expense'));
    btnInc.addEventListener('click', () => setType('income'));
    btnTrf.addEventListener('click', () => setType('transfer'));

    document.getElementById('form-edit-tx').addEventListener('submit', (e) => {
      e.preventDefault();
      const type = typeInput.value;
      const rawAmount = parseFloat(document.getElementById('edit-tx-amount').value);
      const categoryId = catSelect ? catSelect.value : null;
      const walletId = document.getElementById('edit-tx-wallet').value;
      const toWalletId = document.getElementById('edit-tx-to-wallet').value;
      const date = document.getElementById('edit-tx-date').value;
      const note = document.getElementById('edit-tx-note').value;

      if (!rawAmount || rawAmount <= 0) {
        toast.error('Please enter a valid amount.');
        return;
      }
      if (type === 'transfer' && walletId === toWalletId) {
        toast.error('Source and destination accounts must be different.');
        return;
      }

      const updated = store.updateTransaction(txId, {
        type,
        amount: store.toBaseAmount(rawAmount),
        categoryId: type === 'transfer' ? null : categoryId,
        walletId,
        toWalletId: type === 'transfer' ? toWalletId : null,
        date,
        note
      });

      if (updated) {
        this.close();
        toast.success('Transaction updated.');
      } else {
        toast.error('Could not update transaction.');
      }
    });
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
    const threshold = Math.min(100, Math.max(1, Number(store.state.settings?.spendingAlertPercent) || 85));

    if (percent >= 100) {
      toast.warning(`Budget Alert: You have exceeded 100% of your budget for "${cat?.name}".`);
    } else if (percent >= threshold) {
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
              <label class="form-label" id="w-balance-label">Initial Balance (${curr.code})</label>
              <input type="number" id="w-balance" class="form-input" placeholder="0" value="0" step="any">
              <span class="form-hint" id="w-balance-hint" style="display: none;">Enter negative for current debt owed (e.g. -5000), or 0 if paid in full.</span>
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
    const balanceLabel = document.getElementById('w-balance-label');
    const balanceHint = document.getElementById('w-balance-hint');
    typeSelect.addEventListener('change', () => {
      const isCredit = typeSelect.value === 'credit';
      creditGroup.style.display = isCredit ? 'block' : 'none';
      if (balanceLabel) balanceLabel.innerText = isCredit ? `Starting Balance / Debt (${curr.code})` : `Initial Balance (${curr.code})`;
      if (balanceHint) balanceHint.style.display = isCredit ? 'block' : 'none';
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

  showEditWalletModal(walletId) {
    const wallet = store.state.wallets.find(w => w.id === walletId);
    if (!wallet) return;
    const curr = store.currentCurrency;
    const displayBalance = Number(store.fromBaseAmount(wallet.balance).toFixed(curr.decimals));
    const displayLimit = Number(store.fromBaseAmount(wallet.creditLimit || 0).toFixed(curr.decimals));
    const icons = ['🏛️', '💵', '💳', '📱', '🏦', '📈', '🪙'];

    const html = `
      <div class="modal-header">
        <h3 class="modal-title">Edit Account</h3>
        <button class="modal-close-btn" data-action="close-modal" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body">
        <form id="form-edit-wallet">
          <div class="form-group">
            <label class="form-label">Account Name</label>
            <input type="text" id="edit-w-name" class="form-input" value="${escapeHtml(wallet.name)}" required autofocus>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Account Type</label>
              <select id="edit-w-type" class="form-select">
                <option value="bank" ${wallet.type === 'bank' ? 'selected' : ''}>🏛️ Bank Account</option>
                <option value="cash" ${wallet.type === 'cash' ? 'selected' : ''}>💵 Cash</option>
                <option value="credit" ${wallet.type === 'credit' ? 'selected' : ''}>💳 Credit Card</option>
                <option value="ewallet" ${wallet.type === 'ewallet' ? 'selected' : ''}>📱 Digital Wallet</option>
                <option value="savings" ${wallet.type === 'savings' ? 'selected' : ''}>🏦 Savings & Investment</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Icon</label>
              <select id="edit-w-icon" class="form-select">
                ${icons.map(ic => `<option value="${ic}" ${wallet.icon === ic ? 'selected' : ''}>${ic}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" id="edit-w-balance-label">${wallet.type === 'credit' ? `Current Balance / Debt (${curr.code})` : `Current Balance (${curr.code})`}</label>
              <input type="number" id="edit-w-balance" class="form-input" value="${displayBalance}" step="any">
              <span class="form-hint" id="edit-w-balance-hint" style="display: ${wallet.type === 'credit' ? 'block' : 'none'};">Negative balance represents credit card debt owed.</span>
            </div>

            <div class="form-group" id="edit-group-credit-limit" style="display: ${wallet.type === 'credit' ? 'block' : 'none'};">
              <label class="form-label">Credit Limit (${curr.code})</label>
              <input type="number" id="edit-w-credit-limit" class="form-input" value="${displayLimit}" min="0" step="any">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Account / Card Number (Optional)</label>
            <input type="text" id="edit-w-acc-num" class="form-input" value="${escapeHtml(wallet.accountNumber || '')}" placeholder="e.g. 1903... or ****1234">
          </div>

          <div class="modal-footer" style="margin: 16px -20px -20px; padding: 14px 20px;">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;

    this.open(html);

    const typeSelect = document.getElementById('edit-w-type');
    const creditGroup = document.getElementById('edit-group-credit-limit');
    const editBalanceLabel = document.getElementById('edit-w-balance-label');
    const editBalanceHint = document.getElementById('edit-w-balance-hint');
    typeSelect.addEventListener('change', () => {
      const isCredit = typeSelect.value === 'credit';
      creditGroup.style.display = isCredit ? 'block' : 'none';
      if (editBalanceLabel) editBalanceLabel.innerText = isCredit ? `Current Balance / Debt (${curr.code})` : `Current Balance (${curr.code})`;
      if (editBalanceHint) editBalanceHint.style.display = isCredit ? 'block' : 'none';
    });

    document.getElementById('form-edit-wallet').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('edit-w-name').value.trim();
      const type = typeSelect.value;
      const rawBalance = parseFloat(document.getElementById('edit-w-balance').value) || 0;
      const rawCreditLimit = Math.max(0, parseFloat(document.getElementById('edit-w-credit-limit').value) || 0);
      const accountNumber = document.getElementById('edit-w-acc-num').value.trim();
      const icon = document.getElementById('edit-w-icon').value;
      if (!name) return;

      store.updateWallet(walletId, {
        name,
        type,
        balance: store.toBaseAmount(rawBalance),
        creditLimit: store.toBaseAmount(rawCreditLimit),
        accountNumber,
        icon
      });
      this.close();
      toast.success(`Account "${name}" updated.`);
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
    const defaultDeadline = advanceDateKey(localDateKey(), 'yearly');
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
              <input type="date" id="g-deadline" class="form-input" value="${defaultDeadline}" required>
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

  showEditGoalModal(goalId) {
    const goal = store.state.goals.find(g => g.id === goalId);
    if (!goal) return;
    const curr = store.currentCurrency;
    const displayTarget = Number(store.fromBaseAmount(goal.targetAmount).toFixed(curr.decimals));
    const baselineBase = store.goalStartingAmount(goal);
    const displayBaseline = Number(store.fromBaseAmount(baselineBase).toFixed(curr.decimals));
    const icons = ['🎯', '🛡️', '🚗', '🏠', '✈️', '💻', '🎓'];

    const html = `
      <div class="modal-header">
        <h3 class="modal-title">Edit Savings Goal</h3>
        <button class="modal-close-btn" data-action="close-modal" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body">
        <form id="form-edit-goal">
          <div class="form-group">
            <label class="form-label">Goal Title</label>
            <input type="text" id="edit-g-title" class="form-input" value="${escapeHtml(goal.title)}" required autofocus>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Target Amount (${curr.code})</label>
              <input type="number" id="edit-g-target" class="form-input" value="${displayTarget}" min="1" step="any" required>
            </div>

            <div class="form-group">
              <label class="form-label">Starting Saved (${curr.code})</label>
              <input type="number" id="edit-g-starting" class="form-input" value="${displayBaseline}" min="0" step="any">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Target Completion Date</label>
              <input type="date" id="edit-g-deadline" class="form-input" value="${escapeHtml(goal.deadline)}" required>
            </div>

            <div class="form-group">
              <label class="form-label">Icon</label>
              <select id="edit-g-icon" class="form-select">
                ${icons.map(ic => `<option value="${ic}" ${goal.icon === ic ? 'selected' : ''}>${ic}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="modal-footer" style="margin: 16px -20px -20px; padding: 14px 20px;">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;

    this.open(html);

    document.getElementById('form-edit-goal').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('edit-g-title').value.trim();
      const rawTarget = parseFloat(document.getElementById('edit-g-target').value) || 0;
      const rawStarting = Math.max(0, parseFloat(document.getElementById('edit-g-starting').value) || 0);
      const deadline = document.getElementById('edit-g-deadline').value;
      const icon = document.getElementById('edit-g-icon').value;

      if (!title || rawTarget <= 0) {
        toast.error('Please enter a goal name and valid target amount.');
        return;
      }

      const baseline = store.toBaseAmount(rawStarting);
      const updated = store.updateGoal(goalId, {
        title,
        targetAmount: store.toBaseAmount(rawTarget),
        startingAmount: store.hasGoalStartingAmount(goal) ? baseline : undefined,
        currentAmount: !store.hasGoalStartingAmount(goal) ? baseline : undefined,
        deadline,
        icon
      });

      if (updated) {
        this.close();
        toast.success(`Savings goal "${title}" updated.`);
      } else {
        toast.error('Please enter valid goal details.');
      }
    });
  }

  showRecordDebtPaymentModal(debtId) {
    const debt = store.state.debts.find(item => item.id === debtId);
    if (!debt) return;
    const curr = store.currentCurrency;
    const suggestedBase = Math.min(debt.minimumPayment || debt.balance, debt.balance);
    const suggestedDisplay = Number(store.fromBaseAmount(suggestedBase).toFixed(curr.decimals));
    const maxDisplay = Number(store.fromBaseAmount(debt.balance).toFixed(curr.decimals));

    const html = `
      <div class="modal-header">
        <h3 class="modal-title">${debt.kind === 'receivable' ? 'Record Received Payment' : 'Record Debt Payment'}</h3>
        <button class="modal-close-btn" data-action="close-modal" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body">
        <p style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 14px;">
          <strong>${escapeHtml(debt.name)}</strong> · Remaining balance: <strong class="privacy-sensitive">${store.formatMoney(debt.balance)}</strong>
        </p>
        <form id="form-debt-payment">
          <div class="form-group">
            <label class="form-label">Payment Amount (${curr.code})</label>
            <input type="number" id="debt-pay-amount" class="form-input" value="${suggestedDisplay}" min="0.01" max="${maxDisplay}" step="any" required autofocus>
            <span class="form-hint">This will update the remaining balance and record a transaction in the linked account.</span>
          </div>
          <div class="modal-footer" style="margin: 16px -20px -20px; padding: 14px 20px;">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Record Payment</button>
          </div>
        </form>
      </div>
    `;

    this.open(html);

    document.getElementById('form-debt-payment').addEventListener('submit', (e) => {
      e.preventDefault();
      const rawAmount = parseFloat(document.getElementById('debt-pay-amount').value) || 0;
      if (rawAmount <= 0) {
        toast.error('Enter a positive payment amount.');
        return;
      }
      if (store.recordDebtPayment(debtId, store.toBaseAmount(rawAmount))) {
        this.close();
        toast.success('Payment recorded and balance updated.');
      } else {
        toast.error('Enter a positive payment and ensure the linked account exists.');
      }
    });
  }

  showEditBillModal(billId) {
    const bill = store.state.bills.find(item => item.id === billId);
    if (!bill) return;
    const curr = store.currentCurrency;
    const displayAmount = Number(store.fromBaseAmount(bill.amount).toFixed(curr.decimals));
    const expenseCategories = CATEGORIES.filter(item => item.type === CATEGORY_TYPES.EXPENSE);
    const wallets = store.state.wallets;

    const html = `
      <div class="modal-header">
        <h3 class="modal-title">Edit Recurring Bill</h3>
        <button class="modal-close-btn" data-action="close-modal" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body">
        <form id="form-edit-bill">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Name</label>
              <input class="form-input" id="edit-bill-name" maxlength="80" value="${escapeHtml(bill.name)}" required autofocus>
            </div>
            <div class="form-group">
              <label class="form-label">Amount (${curr.code})</label>
              <input class="form-input" id="edit-bill-amount" type="number" min="0.01" step="any" value="${displayAmount}" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Next due</label>
              <input class="form-input" id="edit-bill-due" type="date" value="${escapeHtml(bill.nextDue)}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Repeats</label>
              <select class="form-select" id="edit-bill-frequency">
                <option value="monthly" ${bill.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                <option value="yearly" ${bill.frequency === 'yearly' ? 'selected' : ''}>Yearly</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Category</label>
              <select class="form-select" id="edit-bill-category">
                ${expenseCategories.map(item => `<option value="${item.id}" ${item.id === bill.categoryId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Pay from</label>
              <select class="form-select" id="edit-bill-wallet" required>
                ${wallets.map(w => `<option value="${escapeHtml(w.id)}" ${w.id === bill.walletId ? 'selected' : ''}>${escapeHtml(w.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="modal-footer" style="margin: 16px -20px -20px; padding: 14px 20px;">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;

    this.open(html);

    document.getElementById('form-edit-bill').addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        store.updateBill(billId, {
          name: document.getElementById('edit-bill-name').value,
          amount: store.toBaseAmount(document.getElementById('edit-bill-amount').value),
          nextDue: document.getElementById('edit-bill-due').value,
          frequency: document.getElementById('edit-bill-frequency').value,
          categoryId: document.getElementById('edit-bill-category').value,
          walletId: document.getElementById('edit-bill-wallet').value
        });
        this.close();
        toast.success('Recurring bill updated.');
      } catch (error) {
        toast.error(error.message);
      }
    });
  }

  showEditDebtModal(debtId) {
    const debt = store.state.debts.find(item => item.id === debtId);
    if (!debt) return;
    const curr = store.currentCurrency;
    const displayBalance = Number(store.fromBaseAmount(debt.balance).toFixed(curr.decimals));
    const displayMinPay = Number(store.fromBaseAmount(debt.minimumPayment || 0).toFixed(curr.decimals));
    const wallets = store.state.wallets;

    const html = `
      <div class="modal-header">
        <h3 class="modal-title">Edit Debt or Receivable</h3>
        <button class="modal-close-btn" data-action="close-modal" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="modal-body">
        <form id="form-edit-debt">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Name</label>
              <input class="form-input" id="edit-debt-name" maxlength="80" value="${escapeHtml(debt.name)}" required autofocus>
            </div>
            <div class="form-group">
              <label class="form-label">Direction</label>
              <select class="form-select" id="edit-debt-kind">
                <option value="owed" ${debt.kind === 'owed' ? 'selected' : ''}>I owe money</option>
                <option value="receivable" ${debt.kind === 'receivable' ? 'selected' : ''}>Owed to me</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Balance (${curr.code})</label>
              <input class="form-input" id="edit-debt-balance" type="number" min="0.01" step="any" value="${displayBalance}" required>
            </div>
            <div class="form-group">
              <label class="form-label">APR %</label>
              <input class="form-input" id="edit-debt-rate" type="number" min="0" step="0.01" value="${Number(debt.interestRate || 0)}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Monthly payment (${curr.code})</label>
              <input class="form-input" id="edit-debt-payment" type="number" min="0" step="any" value="${displayMinPay}">
            </div>
            <div class="form-group">
              <label class="form-label">Next due</label>
              <input class="form-input" id="edit-debt-due" type="date" value="${escapeHtml(debt.nextDue)}" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Linked account</label>
            <select class="form-select" id="edit-debt-wallet" required>
              ${wallets.map(w => `<option value="${escapeHtml(w.id)}" ${w.id === debt.walletId ? 'selected' : ''}>${escapeHtml(w.name)}</option>`).join('')}
            </select>
          </div>
          <div class="modal-footer" style="margin: 16px -20px -20px; padding: 14px 20px;">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;

    this.open(html);

    document.getElementById('form-edit-debt').addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        store.updateDebt(debtId, {
          name: document.getElementById('edit-debt-name').value,
          kind: document.getElementById('edit-debt-kind').value,
          balance: store.toBaseAmount(document.getElementById('edit-debt-balance').value),
          interestRate: document.getElementById('edit-debt-rate').value,
          minimumPayment: store.toBaseAmount(document.getElementById('edit-debt-payment').value),
          nextDue: document.getElementById('edit-debt-due').value,
          walletId: document.getElementById('edit-debt-wallet').value
        });
        this.close();
        toast.success('Debt record updated.');
      } catch (error) {
        toast.error(error.message);
      }
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
