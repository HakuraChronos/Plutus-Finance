/* ==========================================================================
   PLUTUS FINANCE - BUDGETS & OVERSPEND ALERTS VIEW (MINIMALIST / ENGLISH)
   ========================================================================== */

import { store } from '../state.js';
import { CATEGORIES } from '../models.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { escapeHtml } from '../utils/security.js';

export function renderBudgets(container) {
  const { budgets, transactions } = store.state;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate = now.getDate();
  const daysRemaining = Math.max(1, daysInMonth - todayDate + 1);

  const currentMonth = `${year}-${String(month + 1).padStart(2, '0')}`;

  // Current month expense by category
  const spentMap = {};
  transactions
    .filter(t => t.type === 'expense' && t.date && t.date.startsWith(currentMonth))
    .forEach(t => {
      if (t.categoryId) {
        spentMap[t.categoryId] = (spentMap[t.categoryId] || 0) + t.amount;
      }
    });

  let totalBudgetLimit = 0;
  let totalBudgetSpent = 0;

  const budgetItems = budgets.map(b => {
    const cat = CATEGORIES.find(c => c.id === b.categoryId);
    const spent = spentMap[b.categoryId] || 0;
    const remaining = b.limit - spent;
    const pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;

    totalBudgetLimit += b.limit;
    totalBudgetSpent += spent;

    return {
      ...b,
      catName: cat?.name || 'Category',
      catIcon: cat?.icon || '📁',
      spent,
      remaining,
      pct,
      isOverspent: spent > b.limit,
      isWarning: pct >= 85 && pct <= 100
    };
  });

  const totalRemainingBudget = Math.max(0, totalBudgetLimit - totalBudgetSpent);
  const dailySafeToSpend = Math.round(totalRemainingBudget / daysRemaining);

  container.innerHTML = `
    <!-- Banner: Daily Safe-to-Spend Allowance -->
    <div class="budget-hero-card">
      <div class="budget-daily-safe">
        <span class="budget-daily-label">Safe Daily Spending Allowance (${daysRemaining} days left this month)</span>
        <div class="budget-daily-amount privacy-sensitive">${store.formatMoney(dailySafeToSpend)} / day</div>
        <span style="font-size: 0.78rem; color: var(--text-tertiary);">
          Total Remaining: <strong class="privacy-sensitive" style="color: var(--text-primary);">${store.formatMoney(totalRemainingBudget)}</strong> of ${store.formatMoney(totalBudgetLimit)} limit
        </span>
      </div>

      <div style="display: flex; gap: 8px; align-items: center;">
        <button class="btn btn-primary btn-sm" id="btn-add-budget-view">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          + Set New Budget
        </button>
      </div>
    </div>

    <!-- Category Budgets Grid -->
    <div class="budget-grid">
      ${budgetItems.length === 0 ? `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-medium);">
          <div style="font-size: 2rem; margin-bottom: 8px;">🎯</div>
          <p style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">No category budgets set</p>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 16px;">Set monthly spending limits for categories (dining, groceries, entertainment) to prevent overspending.</p>
          <button class="btn btn-primary btn-sm" id="btn-add-budget-empty">+ Create First Budget</button>
        </div>
      ` : budgetItems.map(b => {
        let statusBadge = '';
        let progressClass = '';

        if (b.isOverspent) {
          statusBadge = `<span class="badge badge-expense">OVER BUDGET (${b.pct}%)</span>`;
          progressClass = 'danger';
        } else if (b.isWarning) {
          statusBadge = `<span class="badge badge-warning">NEAR LIMIT (${b.pct}%)</span>`;
          progressClass = 'warning';
        } else {
          statusBadge = `<span class="badge badge-income">ON TRACK (${b.pct}%)</span>`;
        }

        const safePerDayForCat = Math.max(0, Math.round(b.remaining / daysRemaining));

        return `
          <div class="budget-item-card ${b.isOverspent ? 'overspent' : ''}">
            <div class="budget-card-header">
              <span class="budget-cat-name">${b.catIcon} ${b.catName}</span>
              ${statusBadge}
            </div>

            <div class="budget-figures">
              <div>
                <span style="font-size: 0.74rem; color: var(--text-tertiary);">Spent:</span>
                <div class="budget-spent-txt privacy-sensitive" style="color: ${b.isOverspent ? 'var(--rose-500)' : 'var(--text-primary)'};">
                  ${store.formatMoney(b.spent)}
                </div>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 0.74rem; color: var(--text-tertiary);">Monthly Limit:</span>
                <div class="budget-limit-txt">${store.formatMoney(b.limit)}</div>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="progress-bar-wrap" style="height: 6px;">
              <div class="progress-bar-fill ${progressClass}" style="width: ${Math.min(100, b.pct)}%;"></div>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 0.76rem; color: var(--text-tertiary); border-top: 1px solid var(--border-subtle); padding-top: 10px;">
              <span>
                ${b.isOverspent
                  ? `<strong style="color: var(--rose-500);">Over: -${store.formatMoney(Math.abs(b.remaining))}</strong>`
                  : `Remaining: <strong class="privacy-sensitive" style="color: var(--emerald-500);">${store.formatMoney(b.remaining)}</strong>`}
              </span>
              <span>Daily Safe: <strong>${store.formatMoney(safePerDayForCat)}/day</strong></span>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px;">
              <button class="btn btn-sm btn-secondary btn-quick-expense" data-cat="${escapeHtml(b.categoryId)}" title="Record expense for this category">
                + Expense
              </button>
              <button class="icon-action-btn btn-sm btn-delete-budget" data-id="${escapeHtml(b.id)}" title="Delete budget" aria-label="Delete budget">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Attach Event Handlers
  const btnAdd = document.getElementById('btn-add-budget-view');
  if (btnAdd) btnAdd.addEventListener('click', () => modal.showAddBudgetModal());

  const btnAddEmpty = document.getElementById('btn-add-budget-empty');
  if (btnAddEmpty) btnAddEmpty.addEventListener('click', () => modal.showAddBudgetModal());

  document.querySelectorAll('.btn-quick-expense').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.showAddTransactionModal('expense');
      setTimeout(() => {
        const catSelect = document.getElementById('tx-category');
        if (catSelect) catSelect.value = btn.getAttribute('data-cat');
      }, 50);
    });
  });

  document.querySelectorAll('.btn-delete-budget').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this budget?')) {
        store.deleteBudget(id);
        toast.info('Budget removed.');
      }
    });
  });
}
