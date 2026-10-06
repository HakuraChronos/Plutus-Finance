/* ==========================================================================
   PLUTUS FINANCE - WALLETS & ACCOUNTS VIEW (MINIMALIST / ENGLISH)
   ========================================================================== */

import { store } from '../state.js';
import { WALLET_TYPES } from '../models.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { escapeHtml } from '../utils/security.js';

export function renderWallets(container) {
  const { wallets } = store.state;

  let totalLiquid = 0;
  let totalSavings = 0;
  let totalCreditDebt = 0;
  let totalCreditLimit = 0;

  wallets.forEach(w => {
    if (w.type === 'credit') {
      if (w.balance < 0) totalCreditDebt += Math.abs(w.balance);
      totalCreditLimit += (w.creditLimit || 0);
    } else if (w.type === 'savings') {
      totalSavings += w.balance;
    } else {
      totalLiquid += w.balance;
    }
  });

  container.innerHTML = `
    <!-- Asset Summary Stat Cards -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Liquid Assets</span>
          <div class="stat-icon-wrap">💵</div>
        </div>
        <div class="stat-value privacy-sensitive" style="color: var(--emerald-500);">${store.formatMoney(totalLiquid)}</div>
        <div class="stat-footer">Cash, checking, digital wallets</div>
      </div>

      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Savings & Investments</span>
          <div class="stat-icon-wrap">🏦</div>
        </div>
        <div class="stat-value privacy-sensitive">${store.formatMoney(totalSavings)}</div>
        <div class="stat-footer">Fixed deposits and long-term funds</div>
      </div>

      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Credit Card Debt</span>
          <div class="stat-icon-wrap">💳</div>
        </div>
        <div class="stat-value privacy-sensitive" style="color: var(--rose-500);">${store.formatMoney(totalCreditDebt)}</div>
        <div class="stat-footer">
          <span>Total Limit: ${store.formatMoney(totalCreditLimit)}</span>
        </div>
      </div>
    </div>

    <!-- Action Toolbar -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
      <h3 class="card-title">Accounts & Wallets (${wallets.length})</h3>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary btn-sm" id="btn-quick-transfer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
          Transfer Between Accounts
        </button>
        <button class="btn btn-primary btn-sm" id="btn-add-wallet">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          + Add Account
        </button>
      </div>
    </div>

    <!-- Wallets Grid -->
    <div class="wallets-grid">
      ${wallets.length === 0 ? `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-medium);">
          <div style="font-size: 2rem; margin-bottom: 8px;">🏦</div>
          <p style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">No accounts or wallets added</p>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 16px;">Create your cash, bank accounts, or credit cards to start tracking balances and net worth.</p>
          <button class="btn btn-primary btn-sm" id="btn-empty-add-wallet">+ Create First Account</button>
        </div>
      ` : wallets.map(w => {
        const typeInfo = WALLET_TYPES[w.type ? w.type.toUpperCase() : 'BANK'] || WALLET_TYPES.BANK;
        const isCredit = w.type === 'credit';
        const cardClass = typeInfo.class || 'wallet-card-bank';

        let creditDetails = '';
        if (isCredit) {
          const avail = Math.max(0, (w.creditLimit || 0) - Math.abs(w.balance));
          creditDetails = `
            <div style="font-size: 0.72rem; background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: var(--radius-xs); margin: 6px 0; border: 1px solid rgba(255,255,255,0.06);">
              <div>Limit: <strong>${store.formatMoney(w.creditLimit || 0)}</strong></div>
              <div>Available: <strong>${store.formatMoney(avail)}</strong></div>
            </div>
          `;
        }

        return `
          <div class="wallet-card ${cardClass}">
            <div class="wallet-top">
              <span style="font-size: 1.3rem;">${escapeHtml(w.icon || typeInfo.icon)}</span>
              <span class="wallet-type-chip">${typeInfo.name}</span>
            </div>

            <div class="wallet-balance-wrap">
              <span class="wallet-balance-label">${isCredit ? 'OUTSTANDING BALANCE' : 'CURRENT BALANCE'}</span>
              <div class="wallet-balance-num privacy-sensitive">
                ${store.formatMoney(Math.abs(w.balance))}
              </div>
              ${creditDetails}
            </div>

            <div class="wallet-bottom">
              <div>
                <strong style="font-size: 0.9rem; color: var(--text-primary);">${escapeHtml(w.name)}</strong>
                ${w.accountNumber ? `<div style="font-size: 0.72rem; color: var(--text-tertiary); font-family: var(--font-mono);">${escapeHtml(w.accountNumber)}</div>` : ''}
              </div>
              <button class="icon-action-btn btn-sm btn-delete-wallet" data-id="${escapeHtml(w.id)}" title="Delete account" aria-label="Delete account">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Attach Event Listeners
  const btnAdd = document.getElementById('btn-add-wallet');
  if (btnAdd) btnAdd.addEventListener('click', () => modal.showAddWalletModal());

  const btnEmptyAdd = document.getElementById('btn-empty-add-wallet');
  if (btnEmptyAdd) btnEmptyAdd.addEventListener('click', () => modal.showAddWalletModal());

  const btnTransfer = document.getElementById('btn-quick-transfer');
  if (btnTransfer) btnTransfer.addEventListener('click', () => modal.showAddTransactionModal('transfer'));

  document.querySelectorAll('.btn-delete-wallet').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this account?')) {
        store.deleteWallet(id);
        toast.info('Account deleted.');
      }
    });
  });
}
