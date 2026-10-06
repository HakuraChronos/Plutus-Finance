/* ==========================================================================
   PLUTUS FINANCE - GOALS & SAVINGS ACCUMULATION VIEW (MINIMALIST / ENGLISH)
   ========================================================================== */

import { store } from '../state.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { escapeHtml } from '../utils/security.js';
import { monthsRemaining } from '../utils/dates.js';

export function renderGoals(container) {
  const { goals } = store.state;

  let totalTarget = 0;
  let totalSaved = 0;

  goals.forEach(g => {
    totalTarget += g.targetAmount;
    totalSaved += g.currentAmount;
  });

  const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  container.innerHTML = `
    <!-- Goals Overview Stat Cards -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Total Savings Target</span>
          <div class="stat-icon-wrap">🎯</div>
        </div>
        <div class="stat-value privacy-sensitive">${store.formatMoney(totalTarget)}</div>
        <div class="stat-footer">Tracking ${goals.length} milestone goals</div>
      </div>

      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Total Accumulated</span>
          <div class="stat-icon-wrap">💰</div>
        </div>
        <div class="stat-value privacy-sensitive" style="color: var(--emerald-500);">${store.formatMoney(totalSaved)}</div>
        <div class="stat-footer">${overallPct}% of target reached</div>
      </div>

      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Remaining to Target</span>
          <div class="stat-icon-wrap">⏳</div>
        </div>
        <div class="stat-value privacy-sensitive">${store.formatMoney(Math.max(0, totalTarget - totalSaved))}</div>
        <div class="stat-footer">Keep building your monthly reserves</div>
      </div>
    </div>

    <!-- Header & Action Button -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
      <h3 class="card-title">Savings & Milestone Goals</h3>
      <button class="btn btn-primary btn-sm" id="btn-add-goal-view">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        + Create New Goal
      </button>
    </div>

    <!-- Goals Grid -->
    <div class="goals-grid">
      ${goals.length === 0 ? `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-medium);">
          <div style="font-size: 2rem; margin-bottom: 8px;">🎯</div>
          <p style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">No savings goals created</p>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 16px;">Set milestone targets for emergency funds, travel, or major purchases to stay focused.</p>
          <button class="btn btn-primary btn-sm" id="btn-add-goal-empty">+ Create First Goal</button>
        </div>
      ` : goals.map(g => {
        const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
        const remaining = Math.max(0, g.targetAmount - g.currentAmount);

        // Calculate months remaining
        const remainingMonths = monthsRemaining(g.deadline);
        const diffMonths = remainingMonths === null ? 0 : remainingMonths;
        const monthlyNeeded = Math.round(remaining / Math.max(1, diffMonths));

        return `
          <div class="goal-card">
            <div class="goal-top">
              <div class="goal-icon-badge">${escapeHtml(g.icon || '🎯')}</div>
              <span class="badge ${pct >= 100 ? 'badge-income' : 'badge-neutral'}">
                ${pct >= 100 ? 'Completed!' : `${pct}% reached`}
              </span>
            </div>

            <div>
              <h4 class="goal-title">${escapeHtml(g.title)}</h4>
              <span class="goal-deadline">Deadline: <strong>${escapeHtml(g.deadline)}</strong> (${diffMonths > 0 ? `~${diffMonths} months remaining` : 'due or past due'})</span>
            </div>

            <div class="goal-metric-row">
              <div>
                <span style="font-size: 0.72rem; color: var(--text-tertiary);">Saved:</span>
                <div class="goal-current-amount privacy-sensitive">${store.formatMoney(g.currentAmount)}</div>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 0.72rem; color: var(--text-tertiary);">Target:</span>
                <div class="goal-target-amount">${store.formatMoney(g.targetAmount)}</div>
              </div>
            </div>

            <div class="progress-bar-wrap" style="height: 6px;">
              <div class="progress-bar-fill" style="width: ${pct}%;"></div>
            </div>

            <div style="font-size: 0.76rem; color: var(--text-secondary); background: var(--bg-tertiary); padding: 8px 12px; border-radius: var(--radius-xs);">
              ${pct >= 100
                ? 'Target reached! Congratulations on achieving this milestone.'
                : diffMonths > 0
                  ? `Save <strong style="color: var(--emerald-500);">${store.formatMoney(monthlyNeeded)}</strong> / month to stay on schedule.`
                  : `<strong style="color: var(--rose-500);">${store.formatMoney(remaining)}</strong> is still needed for this past-due goal.`
              }
            </div>

            <div style="display: flex; gap: 8px; margin-top: 4px;">
              <button class="btn btn-primary btn-sm btn-deposit-goal" data-id="${escapeHtml(g.id)}" style="flex: 1;">
                + Deposit Funds
              </button>
              <button class="icon-action-btn btn-sm btn-delete-goal" data-id="${escapeHtml(g.id)}" title="Delete goal" aria-label="Delete goal">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Attach Event Handlers
  const btnAdd = document.getElementById('btn-add-goal-view');
  if (btnAdd) btnAdd.addEventListener('click', () => modal.showAddGoalModal());

  const btnAddEmpty = document.getElementById('btn-add-goal-empty');
  if (btnAddEmpty) btnAddEmpty.addEventListener('click', () => modal.showAddGoalModal());

  document.querySelectorAll('.btn-deposit-goal').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      modal.showDepositGoalModal(id);
    });
  });

  document.querySelectorAll('.btn-delete-goal').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this savings goal?')) {
        store.deleteGoal(id);
        toast.info('Savings goal removed.');
      }
    });
  });
}
