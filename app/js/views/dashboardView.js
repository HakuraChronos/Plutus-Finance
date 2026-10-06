/* ==========================================================================
   PLUTUS FINANCE - DASHBOARD VIEW (MINIMALIST / ENGLISH)
   ========================================================================== */

import { store } from '../state.js';
import { CATEGORIES, RULE_50_30_20, calculateFinancialHealthScore } from '../models.js';
import { renderCashFlowChart, renderCategoryDonutChart } from '../components/charts.js';
import { modal } from '../components/modal.js';

export function renderDashboard(container) {
  const { transactions, wallets, budgets } = store.state;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;
  const currentMonth = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;
  const monthName = now.toLocaleString('en-US', { month: 'short' });

  // 1. Calculate Net Worth
  let totalAssets = 0;
  let totalDebt = 0;
  let creditLimit = 0;

  wallets.forEach(w => {
    if (w.balance >= 0) {
      totalAssets += w.balance;
    } else {
      totalDebt += Math.abs(w.balance);
    }
    if (w.type === 'credit') {
      creditLimit += (w.creditLimit || 0);
    }
  });

  const netWorth = totalAssets - totalDebt;

  // 2. Current Month Income & Expense
  const monthTransactions = transactions.filter(t => t.date && t.date.startsWith(currentMonth));
  const monthIncome = monthTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const monthExpense = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const monthSurplus = monthIncome - monthExpense;
  const savingsRate = monthIncome > 0 ? Math.round((monthSurplus / monthIncome) * 100) : 0;

  // 3. 50/30/20 Rule Breakdown
  let spentNeeds = 0;
  let spentWants = 0;
  let spentSavings = 0;
  const categorySpentMap = {};

  monthTransactions.filter(t => t.type === 'expense').forEach(t => {
    const cat = CATEGORIES.find(c => c.id === t.categoryId);
    const rule = cat?.ruleGroup || RULE_50_30_20.WANTS;

    if (rule === RULE_50_30_20.NEEDS) spentNeeds += t.amount;
    else if (rule === RULE_50_30_20.WANTS) spentWants += t.amount;
    else if (rule === RULE_50_30_20.SAVINGS) spentSavings += t.amount;

    if (t.categoryId) {
      categorySpentMap[t.categoryId] = (categorySpentMap[t.categoryId] || 0) + t.amount;
    }
  });

  const pctNeeds = monthIncome > 0 ? Math.round((spentNeeds / monthIncome) * 100) : 0;
  const pctWants = monthIncome > 0 ? Math.round((spentWants / monthIncome) * 100) : 0;
  const pctSavings = monthIncome > 0 ? Math.round((spentSavings / monthIncome) * 100) : 0;

  // 4. Financial Health Score
  const health = calculateFinancialHealthScore({
    totalIncome: monthIncome,
    totalExpense: monthExpense,
    totalLiquidAssets: totalAssets,
    monthlyNeeds: spentNeeds,
    creditCardDebt: totalDebt,
    creditLimit
  });

  // 5. Budget Alerts
  const budgetAlerts = [];
  budgets.forEach(b => {
    const spent = categorySpentMap[b.categoryId] || 0;
    const pct = Math.round((spent / b.limit) * 100);
    const cat = CATEGORIES.find(c => c.id === b.categoryId);
    if (pct >= 85) {
      budgetAlerts.push({
        catName: cat?.name || 'Category',
        limit: b.limit,
        spent,
        pct,
        isOver: pct >= 100
      });
    }
  });

  // 6. Generate 6-month historical data points for chart
  const dataPoints = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, now.getMonth() - i, 1);
    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short' });

    const mTx = transactions.filter(t => t.date && t.date.startsWith(mStr));
    const inc = mTx.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
    const exp = mTx.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);

    dataPoints.push({ label, income: inc, expense: exp });
  }

  // 7. Donut chart categories data
  const categoriesWithAmounts = Object.keys(categorySpentMap).map(catId => {
    const cat = CATEGORIES.find(c => c.id === catId);
    return {
      name: cat?.name || 'Other',
      amount: categorySpentMap[catId],
      color: cat?.color || '#a1a1aa'
    };
  });

  const isBrandNew = transactions.length === 0 && wallets.length === 0;

  container.innerHTML = `
    <!-- Onboarding banner if starting fresh -->
    ${isBrandNew ? `
      <div style="background: var(--bg-card); border: 1px dashed var(--border-medium); border-radius: var(--radius-md); padding: 22px; margin-bottom: 22px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
        <div>
          <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 3px;">Welcome to your minimalist workspace</h3>
          <p style="font-size: 0.82rem; color: var(--text-secondary);">Your database is clear and ready. Create your accounts and record your transactions below.</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" id="btn-dash-add-wallet">+ Add Account</button>
          <button class="btn btn-primary btn-sm" id="btn-dash-add-tx">+ Record Transaction</button>
        </div>
      </div>
    ` : ''}

    <!-- Budget Alert Strip (if active) -->
    ${budgetAlerts.length > 0 ? `
      <div class="alert-strip">
        <div class="alert-strip-content">
          <svg class="alert-strip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <div class="alert-strip-text">
            <strong>Budget Alert:</strong> You have used <span class="alert-strip-highlight">${budgetAlerts[0].pct}%</span> of the monthly limit for <strong>${budgetAlerts[0].catName}</strong> (${store.formatMoney(budgetAlerts[0].spent)} / ${store.formatMoney(budgetAlerts[0].limit)}).
          </div>
        </div>
        <button class="btn btn-sm btn-secondary" id="btn-view-budgets-alert">View Budgets</button>
      </div>
    ` : ''}

    <!-- 4 Key Metric Cards -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Net Worth</span>
          <div class="stat-icon-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
        </div>
        <div class="stat-value privacy-sensitive">${store.formatMoney(netWorth)}</div>
        <div class="stat-footer">
          <span>Assets: <strong class="privacy-sensitive">${store.formatMoney(totalAssets)}</strong></span>
          ${totalDebt > 0 ? ` • <span style="color: var(--rose-500);">Liabilities: <strong>${store.formatMoney(totalDebt)}</strong></span>` : ''}
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">${monthName} Income</span>
          <div class="stat-icon-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
          </div>
        </div>
        <div class="stat-value privacy-sensitive" style="color: var(--emerald-500);">${store.formatMoney(monthIncome)}</div>
        <div class="stat-footer">
          <span>${monthTransactions.filter(t => t.type === 'income').length} income records</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">${monthName} Expenses</span>
          <div class="stat-icon-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
          </div>
        </div>
        <div class="stat-value privacy-sensitive" style="color: var(--rose-500);">${store.formatMoney(monthExpense)}</div>
        <div class="stat-footer">
          <span>${monthIncome > 0 ? `${((monthExpense / monthIncome) * 100).toFixed(0)}% of income` : 'No income recorded'}</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Net Surplus</span>
          <div class="stat-icon-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          </div>
        </div>
        <div class="stat-value privacy-sensitive" style="color: ${monthSurplus >= 0 ? 'var(--emerald-500)' : 'var(--rose-500)'};">
          ${store.formatMoney(monthSurplus)}
        </div>
        <div class="stat-footer">
          <span>Savings Rate: <strong>${savingsRate}%</strong> (Target >20%)</span>
        </div>
      </div>
    </div>

    <!-- Charts & Financial Health -->
    <div class="dashboard-grid-main">
      <div class="card chart-card-wrap">
        <div class="card-header">
          <div>
            <h3 class="card-title">Cash Flow Trend (6 Months)</h3>
            <p class="card-subtitle">Comparison of monthly income and expenses</p>
          </div>
          <div style="display: flex; gap: 12px; font-size: 0.76rem;">
            <span style="display: flex; align-items: center; gap: 4px; color: var(--emerald-500);">● Income</span>
            <span style="display: flex; align-items: center; gap: 4px; color: var(--rose-500);">● Expense</span>
          </div>
        </div>
        <div class="chart-canvas-container">
          <canvas id="cashflow-chart"></canvas>
        </div>
      </div>

      <div class="card health-score-card">
        <h3 class="card-title" style="margin-bottom: 2px;">Financial Health</h3>
        <p class="card-subtitle">Economic assessment</p>

        <div class="health-gauge-circle">
          <div class="health-score-number">${health.score}</div>
        </div>

        <span class="health-badge-status">${health.label}</span>
        <p class="health-advice">${health.advice}</p>
      </div>
    </div>

    <!-- 50/30/20 Rule & Expense Donut Distribution -->
    <div class="dashboard-grid-main" style="margin-bottom: 0;">
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">50 / 30 / 20 Budget Rule</h3>
            <p class="card-subtitle">Recommended allocation: 50% Needs, 30% Wants, 20% Savings</p>
          </div>
        </div>

        <div class="rule-card-grid">
          <div class="rule-column rule-needs">
            <div class="rule-header">
              <span class="rule-name">Needs</span>
              <span class="rule-percent">${pctNeeds}% / 50%</span>
            </div>
            <span class="rule-amount privacy-sensitive">${store.formatMoney(spentNeeds)}</span>
            <span class="rule-status-text">Housing, bills, groceries, fuel</span>
          </div>

          <div class="rule-column rule-wants">
            <div class="rule-header">
              <span class="rule-name">Wants</span>
              <span class="rule-percent">${pctWants}% / 30%</span>
            </div>
            <span class="rule-amount privacy-sensitive">${store.formatMoney(spentWants)}</span>
            <span class="rule-status-text">Dining, shopping, leisure</span>
          </div>

          <div class="rule-column rule-savings">
            <div class="rule-header">
              <span class="rule-name">Savings</span>
              <span class="rule-percent">${pctSavings}% / 20%</span>
            </div>
            <span class="rule-amount privacy-sensitive">${store.formatMoney(spentSavings)}</span>
            <span class="rule-status-text">Emergency fund, investments</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Expense Distribution</h3>
            <p class="card-subtitle">${monthName} spending by category</p>
          </div>
        </div>
        <div style="height: 180px; position: relative;">
          <canvas id="donut-chart"></canvas>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  const btnDashAddWallet = document.getElementById('btn-dash-add-wallet');
  if (btnDashAddWallet) {
    btnDashAddWallet.addEventListener('click', () => modal.showAddWalletModal());
  }

  const btnDashAddTx = document.getElementById('btn-dash-add-tx');
  if (btnDashAddTx) {
    btnDashAddTx.addEventListener('click', () => modal.showAddTransactionModal());
  }

  const btnAlert = document.getElementById('btn-view-budgets-alert');
  if (btnAlert) {
    btnAlert.addEventListener('click', () => {
      if (window.plutusApp) window.plutusApp.switchView('budgets');
    });
  }

  // Render Charts
  const cashCanvas = document.getElementById('cashflow-chart');
  if (cashCanvas) {
    renderCashFlowChart(cashCanvas, dataPoints);
  }

  const donutCanvas = document.getElementById('donut-chart');
  if (donutCanvas) {
    renderCategoryDonutChart(donutCanvas, categoriesWithAmounts);
  }
}
