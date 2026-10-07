import { store } from '../state.js';
import { CATEGORIES, calculateFinancialHealthScore } from '../models.js';
import { renderCashFlowChart, renderCategoryDonutChart } from '../components/charts.js';
import { modal } from '../components/modal.js';
import { localMonthKey } from '../utils/dates.js';
import { calculatePlanningSummary, spendingAlerts } from '../utils/planning.js';
import { escapeHtml } from '../utils/security.js';
import { toast } from '../components/toast.js';

const percentage = (amount, income) => income > 0 ? `${Math.round(amount / income * 100)}%` : 'N/A';

export function renderDashboard(container) {
  const state = store.state;
  const { transactions, wallets } = state;
  const now = new Date();
  const currentYear = now.getFullYear();
  const monthName = now.toLocaleString('en-US', { month: 'short' });
  const planning = calculatePlanningSummary(state, now);
  const { activity, targets } = planning;
  const alerts = spendingAlerts(state, now);

  let totalAssets = 0;
  let totalDebt = 0;
  let creditLimit = 0;
  wallets.forEach(wallet => {
    if (wallet.balance >= 0) totalAssets += wallet.balance;
    else totalDebt += Math.abs(wallet.balance);
    if (wallet.type === 'credit') creditLimit += wallet.creditLimit || 0;
  });
  const trackedDebt = (state.debts || []).filter(item => item.active !== false && item.kind === 'owed').reduce((sum, item) => sum + (Number(item.balance) || 0), 0);
  const trackedReceivables = (state.debts || []).filter(item => item.active !== false && item.kind === 'receivable').reduce((sum, item) => sum + (Number(item.balance) || 0), 0);
  const netWorth = totalAssets + trackedReceivables - totalDebt - trackedDebt;
  const savingsRate = activity.income > 0 ? Math.round(activity.surplus / activity.income * 100) : null;
  const health = calculateFinancialHealthScore({
    totalIncome: activity.income,
    totalExpense: activity.expense,
    totalLiquidAssets: totalAssets,
    monthlyNeeds: activity.groups.needs,
    creditCardDebt: totalDebt,
    creditLimit
  });

  const dataPoints = [];
  for (let index = 5; index >= 0; index--) {
    const date = new Date(currentYear, now.getMonth() - index, 1);
    const month = localMonthKey(date);
    const items = transactions.filter(item => item.date?.startsWith(month));
    dataPoints.push({
      label: date.toLocaleString('en-US', { month: 'short' }),
      income: items.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0),
      expense: items.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
    });
  }

  const categoriesWithAmounts = Object.entries(activity.categories).map(([categoryId, amount]) => {
    const category = CATEGORIES.find(item => item.id === categoryId);
    return { name: category?.name || 'Other', amount, color: category?.color || '#a1a1aa' };
  }).sort((a, b) => b.amount - a.amount);
  const expenseTotal = categoriesWithAmounts.reduce((sum, item) => sum + item.amount, 0);
  const isBrandNew = transactions.length === 0 && wallets.length === 0;

  container.innerHTML = `
    ${isBrandNew ? `<div class="dashboard-onboarding"><div><h3>Welcome to your private finance workspace</h3><p>Create an account, then record income and expenses to unlock forecasts and health insights.</p></div><div><button class="btn btn-secondary btn-sm" id="btn-dash-add-wallet">+ Add Account</button><button class="btn btn-primary btn-sm" id="btn-dash-add-tx">+ Record Transaction</button></div></div>` : ''}

    ${alerts.length ? `<section class="alerts-panel" aria-label="Spending alerts">
      ${alerts.slice(0, 4).map(alert => `<div class="planning-alert ${alert.severity}"><div><strong>${escapeHtml(alert.title)}</strong><span>${escapeHtml(alert.message)}</span></div><span class="badge ${alert.severity === 'danger' ? 'badge-expense' : 'badge-warning'}">${alert.type}</span></div>`).join('')}
    </section>` : ''}

    <div class="stat-grid planning-stat-grid">
      <div class="stat-card"><span class="stat-label">Net worth</span><span class="stat-value privacy-sensitive">${store.formatMoney(netWorth)}</span><span class="stat-footer">Assets + receivables ${store.formatMoney(totalAssets + trackedReceivables)}${totalDebt + trackedDebt ? ` · Liabilities ${store.formatMoney(totalDebt + trackedDebt)}` : ''}</span></div>
      <div class="stat-card"><span class="stat-label">${monthName} income</span><span class="stat-value privacy-sensitive" style="color:var(--emerald-500)">${store.formatMoney(activity.income)}</span><span class="stat-footer">${activity.transactions.filter(item => item.type === 'income').length} income record(s)</span></div>
      <div class="stat-card"><span class="stat-label">${monthName} expenses</span><span class="stat-value privacy-sensitive" style="color:var(--rose-500)">${store.formatMoney(activity.expense)}</span><span class="stat-footer">${activity.income > 0 ? percentage(activity.expense, activity.income) + ' of income' : 'N/A · no income recorded'}</span></div>
      <div class="stat-card"><span class="stat-label">Safe to spend</span><span class="stat-value privacy-sensitive" style="color:${planning.safeToSpend >= 0 ? 'var(--emerald-500)' : 'var(--rose-500)'}">${store.formatMoney(planning.safeToSpend)}</span><span class="stat-footer">After bills, debt, and planned savings</span></div>
      <div class="stat-card"><span class="stat-label">Month-end forecast</span><span class="stat-value privacy-sensitive" style="color:${planning.forecastBalance >= 0 ? 'var(--text-primary)' : 'var(--rose-500)'}">${store.formatMoney(planning.forecastBalance)}</span><span class="stat-footer">Estimated from current pace and due commitments</span></div>
      <div class="stat-card"><span class="stat-label">Net surplus</span><span class="stat-value privacy-sensitive">${store.formatMoney(activity.surplus)}</span><span class="stat-footer">Savings rate: <strong>${savingsRate === null ? 'N/A' : `${savingsRate}%`}</strong></span></div>
    </div>

    <section class="card chart-card-wrap cashflow-wide">
      <div class="card-header"><div><h3 class="card-title">Cash-flow trend</h3><p class="card-subtitle">Six months of income and expenses</p></div><div class="chart-key"><span class="income-key">● Income</span><span class="expense-key">● Expense</span></div></div>
      <div class="chart-canvas-container"><canvas id="cashflow-chart"></canvas></div>
    </section>

    <div class="dashboard-grid-main dashboard-planning-grid">
      <section class="card health-score-card">
        <h3 class="card-title">Financial health</h3><p class="card-subtitle">Based on cash flow, reserves, and debt</p>
        <div class="health-gauge-circle"><div class="health-score-number ${health.score === null ? 'health-score-empty' : ''}">${health.score === null ? '—' : health.score}</div></div>
        <span class="health-badge-status">${health.label}</span><p class="health-advice">${health.advice}</p>
      </section>

      <section class="card allocation-card">
        <div class="card-header"><div><h3 class="card-title">Allocation targets</h3><p class="card-subtitle">Customize needs, wants, and savings; total must equal 100%</p></div></div>
        <form id="form-allocation" class="allocation-form">
          <label>Needs <input class="form-input" id="target-needs" type="number" min="0" max="100" step="1" value="${targets.needs}"></label>
          <label>Wants <input class="form-input" id="target-wants" type="number" min="0" max="100" step="1" value="${targets.wants}"></label>
          <label>Savings <input class="form-input" id="target-savings" type="number" min="0" max="100" step="1" value="${targets.savings}"></label>
          <label>Alert at <input class="form-input" id="target-alert" type="number" min="1" max="100" step="1" value="${state.settings.spendingAlertPercent}"></label>
          <button class="btn btn-secondary btn-sm" type="submit">Save targets</button>
        </form>
        <div class="rule-card-grid">
          <div class="rule-column rule-needs"><div class="rule-header"><span class="rule-name">Needs</span><span class="rule-percent">${percentage(activity.groups.needs, activity.income)} / ${targets.needs}%</span></div><span class="rule-amount privacy-sensitive">${store.formatMoney(activity.groups.needs)}</span></div>
          <div class="rule-column rule-wants"><div class="rule-header"><span class="rule-name">Wants</span><span class="rule-percent">${percentage(activity.groups.wants, activity.income)} / ${targets.wants}%</span></div><span class="rule-amount privacy-sensitive">${store.formatMoney(activity.groups.wants)}</span></div>
          <div class="rule-column rule-savings"><div class="rule-header"><span class="rule-name">Savings</span><span class="rule-percent">${percentage(activity.groups.savings, activity.income)} / ${targets.savings}%</span></div><span class="rule-amount privacy-sensitive">${store.formatMoney(activity.groups.savings)}</span></div>
        </div>
      </section>
    </div>

    <section class="card expense-distribution-card">
      <div class="card-header"><div><h3 class="card-title">Expense distribution</h3><p class="card-subtitle">${monthName} category totals and percentages</p></div></div>
      <div class="expense-chart-layout"><div class="expense-chart-canvas"><canvas id="donut-chart"></canvas></div><div class="expense-legend">
        ${categoriesWithAmounts.length ? categoriesWithAmounts.map(item => `<div class="expense-legend-row"><span class="expense-dot" style="background:${item.color}"></span><span>${escapeHtml(item.name)}</span><strong class="privacy-sensitive">${store.formatMoney(item.amount)}</strong><em>${expenseTotal > 0 ? Math.round(item.amount / expenseTotal * 100) : 0}%</em></div>`).join('') : '<div class="empty-inline">No expenses recorded this month.</div>'}
      </div></div>
    </section>
  `;

  document.getElementById('btn-dash-add-wallet')?.addEventListener('click', () => modal.showAddWalletModal());
  document.getElementById('btn-dash-add-tx')?.addEventListener('click', () => modal.showAddTransactionModal());
  document.getElementById('form-allocation').addEventListener('submit', event => {
    event.preventDefault();
    try {
      store.setPlanningSettings({ needs: document.getElementById('target-needs').value, wants: document.getElementById('target-wants').value, savings: document.getElementById('target-savings').value, spendingAlertPercent: document.getElementById('target-alert').value });
      toast.success('Planning targets updated.');
    } catch (error) { toast.error(error.message); }
  });
  renderCashFlowChart(document.getElementById('cashflow-chart'), dataPoints);
  renderCategoryDonutChart(document.getElementById('donut-chart'), categoriesWithAmounts);
}
