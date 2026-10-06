/* ==========================================================================
   PLUTUS FINANCE - TRANSACTIONS VIEW (MINIMALIST / ENGLISH)
   ========================================================================== */

import { store } from '../state.js';
import { CATEGORIES } from '../models.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { escapeHtml } from '../utils/security.js';

let filterType = 'all';
let filterWallet = 'all';
let filterCategory = 'all';
let searchQuery = '';

export function renderTransactions(container) {
  const { transactions, wallets } = store.state;

  // Filter Transactions
  let filtered = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterWallet !== 'all' && t.walletId !== filterWallet && t.toWalletId !== filterWallet) return false;
    if (filterCategory !== 'all' && t.categoryId !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const cat = CATEGORIES.find(c => c.id === t.categoryId);
      const catName = cat ? cat.name.toLowerCase() : '';
      const note = (t.note || '').toLowerCase();
      if (!note.includes(q) && !catName.includes(q)) return false;
    }
    return true;
  });

  // Calculate Summary
  let totalIn = 0;
  let totalOut = 0;
  filtered.forEach(t => {
    if (t.type === 'income') totalIn += t.amount;
    else if (t.type === 'expense') totalOut += t.amount;
  });

  const isCompletelyEmpty = transactions.length === 0;

  container.innerHTML = `
    <!-- Top Action Toolbar -->
    <div class="trans-toolbar">
      <div class="search-box-wrap">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="tx-search-input" class="form-input search-input" placeholder="Search description, category, or note..." value="${searchQuery}">
      </div>

      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <button class="btn btn-secondary btn-sm" id="btn-export-csv" title="Export transactions to CSV">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export CSV
        </button>
        <button class="btn btn-primary btn-sm" id="btn-add-tx-direct">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          + Add Transaction
        </button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <button class="chip-btn ${filterType === 'all' ? 'active' : ''}" data-type="all">All</button>
      <button class="chip-btn ${filterType === 'expense' ? 'active' : ''}" data-type="expense">Expenses</button>
      <button class="chip-btn ${filterType === 'income' ? 'active' : ''}" data-type="income">Income</button>
      <button class="chip-btn ${filterType === 'transfer' ? 'active' : ''}" data-type="transfer">Transfers</button>

      <div style="margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap;">
        <select id="filter-wallet-select" class="form-select" style="width: auto; padding: 5px 10px; font-size: 0.8rem;">
          <option value="all">All Accounts</option>
          ${wallets.map(w => `<option value="${escapeHtml(w.id)}" ${filterWallet === w.id ? 'selected' : ''}>${escapeHtml(w.icon)} ${escapeHtml(w.name)}</option>`).join('')}
        </select>

        <select id="filter-cat-select" class="form-select" style="width: auto; padding: 5px 10px; font-size: 0.8rem;">
          <option value="all">All Categories</option>
          ${CATEGORIES.map(c => `<option value="${c.id}" ${filterCategory === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- Summary Strip -->
    <div class="trans-summary-strip">
      <div class="trans-summary-item">
        <span>Records: <strong>${filtered.length}</strong></span>
      </div>
      <div class="trans-summary-item">
        <span>Income: <strong style="color: var(--emerald-500);">${store.formatMoney(totalIn)}</strong></span>
      </div>
      <div class="trans-summary-item">
        <span>Expenses: <strong style="color: var(--rose-500);">${store.formatMoney(totalOut)}</strong></span>
      </div>
      <div class="trans-summary-item">
        <span>Net: <strong style="color: ${totalIn - totalOut >= 0 ? 'var(--emerald-500)' : 'var(--rose-500)'};">${store.formatMoney(totalIn - totalOut)}</strong></span>
      </div>
    </div>

    <!-- Transactions List -->
    <div class="trans-list">
      ${isCompletelyEmpty ? `
        <div style="text-align: center; padding: 48px 20px; color: var(--text-tertiary); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-medium);">
          <div style="font-size: 2rem; margin-bottom: 8px;">💳</div>
          <p style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">No transactions recorded yet</p>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 16px;">Record your daily income, expenses, and account transfers to track cash flow.</p>
          <button class="btn btn-primary btn-sm" id="btn-empty-add-tx">+ Record First Transaction</button>
        </div>
      ` : filtered.length === 0 ? `
        <div style="text-align: center; padding: 48px 20px; color: var(--text-tertiary); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-medium);">
          <div style="font-size: 2rem; margin-bottom: 8px;">🔍</div>
          <p style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">No matching transactions found</p>
          <p style="font-size: 0.8rem; color: var(--text-secondary);">Try adjusting search keywords or active filters.</p>
        </div>
      ` : filtered.map(t => {
        const cat = CATEGORIES.find(c => c.id === t.categoryId);
        const wallet = wallets.find(w => w.id === t.walletId);
        const toWallet = t.toWalletId ? wallets.find(w => w.id === t.toWalletId) : null;
        const isIncome = t.type === 'income';
        const isTransfer = t.type === 'transfer';

        let badgeHtml = '';
        if (isTransfer) {
          badgeHtml = `<span class="badge badge-transfer">Transfer: ${wallet ? escapeHtml(wallet.name) : ''} ➔ ${toWallet ? escapeHtml(toWallet.name) : ''}</span>`;
        } else if (cat) {
          badgeHtml = `<span class="badge badge-neutral">${cat.icon} ${cat.name}</span>`;
        }

        return `
          <div class="trans-item">
            <div class="trans-left">
              <div class="trans-cat-icon">
                ${isTransfer ? '🔄' : (cat ? cat.icon : (isIncome ? '💰' : '💸'))}
              </div>
              <div class="trans-info">
                <span class="trans-title">${escapeHtml(t.note || (cat ? cat.name : (isTransfer ? 'Account Transfer' : 'Transaction')))}</span>
                <div class="trans-meta">
                  <span>${escapeHtml(t.date)}</span> • <span>${wallet ? `${escapeHtml(wallet.icon)} ${escapeHtml(wallet.name)}` : 'Account'}</span>
                  ${badgeHtml ? ` • ${badgeHtml}` : ''}
                </div>
              </div>
            </div>
            <div class="trans-right">
              <span class="trans-amount ${t.type} privacy-sensitive">
                ${isIncome ? '+' : (isTransfer ? '' : '-')}${store.formatMoney(t.amount)}
              </span>
              <div class="trans-actions">
                <button class="icon-action-btn btn-sm btn-delete-tx" data-id="${escapeHtml(t.id)}" title="Delete transaction" aria-label="Delete transaction">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Attach Event Handlers
  const searchInput = document.getElementById('tx-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderTransactions(container);
    });
  }

  document.querySelectorAll('.filter-bar [data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      filterType = btn.getAttribute('data-type');
      renderTransactions(container);
    });
  });

  const walletSelect = document.getElementById('filter-wallet-select');
  if (walletSelect) {
    walletSelect.addEventListener('change', (e) => {
      filterWallet = e.target.value;
      renderTransactions(container);
    });
  }

  const catSelect = document.getElementById('filter-cat-select');
  if (catSelect) {
    catSelect.addEventListener('change', (e) => {
      filterCategory = e.target.value;
      renderTransactions(container);
    });
  }

  const btnAdd = document.getElementById('btn-add-tx-direct');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => modal.showAddTransactionModal());
  }

  const btnEmptyAdd = document.getElementById('btn-empty-add-tx');
  if (btnEmptyAdd) {
    btnEmptyAdd.addEventListener('click', () => modal.showAddTransactionModal());
  }

  const btnCsv = document.getElementById('btn-export-csv');
  if (btnCsv) {
    btnCsv.addEventListener('click', () => {
      store.exportCSV();
      toast.success('Transactions exported to CSV.');
    });
  }

  // Delete transaction
  document.querySelectorAll('.btn-delete-tx').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Delete this transaction? Account balance will be reverted.')) {
        store.deleteTransaction(id);
        toast.info('Transaction deleted.');
      }
    });
  });
}
