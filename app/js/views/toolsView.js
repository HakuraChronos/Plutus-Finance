/* ==========================================================================
   PLUTUS FINANCE - FINANCIAL TOOLS & CALCULATORS VIEW (MINIMALIST / ENGLISH)
   ========================================================================== */

import { store } from '../state.js';
import { auth } from '../auth.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

export function renderTools(container) {
  const curr = store.currentCurrency;
  const isTWD = curr.code === 'TWD';

  // Sane default values depending on currency
  const defaultCiInitial = isTWD ? 50000 : 2000;
  const defaultCiMonthly = isTWD ? 5000 : 200;
  const defaultLoanAmount = isTWD ? 300000 : 10000;
  const defaultLoanRate = isTWD ? 4.5 : 6.5;

  container.innerHTML = `
    <div class="tools-grid">
      <!-- 1. COMPOUND INTEREST SIMULATOR -->
      <div class="calc-card">
        <div class="card-header" style="margin-bottom: 6px;">
          <div>
            <h3 class="card-title">
              <span style="font-size: 1.2rem;">📈</span>
              Compound Interest Simulator
            </h3>
            <p class="card-subtitle">Visualize the exponential growth of long-term investments</p>
          </div>
        </div>

        <form id="form-calc-compound">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Initial Principal (${curr.code})</label>
              <input type="number" id="ci-initial" class="form-input" value="${defaultCiInitial}" min="0" step="any">
            </div>

            <div class="form-group">
              <label class="form-label">Monthly Contribution (${curr.code})</label>
              <input type="number" id="ci-monthly" class="form-input" value="${defaultCiMonthly}" min="0" step="any">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Annual Return Rate (% / year)</label>
              <input type="number" id="ci-rate" class="form-input" value="8" min="0.5" max="50" step="0.5">
            </div>

            <div class="form-group">
              <label class="form-label">Investment Horizon (Years)</label>
              <input type="number" id="ci-years" class="form-input" value="10" min="1" max="50" step="1">
            </div>
          </div>
        </form>

        <div class="calc-result-box" id="ci-result-box">
          <!-- Rendered dynamically -->
        </div>
      </div>

      <!-- 2. LOAN & MORTGAGE CALCULATOR -->
      <div class="calc-card">
        <div class="card-header" style="margin-bottom: 6px;">
          <div>
            <h3 class="card-title">
              <span style="font-size: 1.2rem;">⚖️</span>
              Loan & Debt Amortization
            </h3>
            <p class="card-subtitle">Estimate monthly payments and total interest costs</p>
          </div>
        </div>

        <form id="form-calc-loan">
          <div class="form-group">
            <label class="form-label">Loan Principal (${curr.code})</label>
            <input type="number" id="loan-amount" class="form-input" value="${defaultLoanAmount}" min="100" step="any">
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Interest Rate (% / year)</label>
              <input type="number" id="loan-rate" class="form-input" value="${defaultLoanRate}" min="0.1" max="40" step="0.1">
            </div>

            <div class="form-group">
              <label class="form-label">Loan Term (Months)</label>
              <input type="number" id="loan-months" class="form-input" value="36" min="1" max="360" step="6">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Amortization Method</label>
            <select id="loan-method" class="form-select">
              <option value="annuity">Equal Monthly Installment (Standard Banking EMI)</option>
              <option value="reducing">Equal Principal (Declining Payment)</option>
              <option value="flat">Flat Interest Rate</option>
            </select>
          </div>
        </form>

        <div class="calc-result-box" id="loan-result-box">
          <!-- Rendered dynamically -->
        </div>
      </div>
    </div>

    <!-- 3. DATA SOVEREIGNTY & BACKUP -->
    <div class="card" style="margin-top: 20px;">
      <div class="card-header">
        <div>
          <h3 class="card-title">
            <span style="font-size: 1.2rem;">🛡️</span>
            Data Sovereignty & Local Storage
          </h3>
          <p class="card-subtitle">This profile lives in <code>User_data/${auth.currentUser?.folder || '…'}</code> and is encrypted with your PIN. Other profiles cannot open this ledger.</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
        <div style="background: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px;">
          <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">Export Encrypted Backup</h4>
          <p style="font-size: 0.76rem; color: var(--text-tertiary);">Download a PIN-encrypted snapshot. Its financial contents are never written as plain text.</p>
          <button class="btn btn-secondary btn-sm" id="btn-export-backup" style="margin-top: auto;">
            💾 Download Backup
          </button>
        </div>

        <div style="background: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px;">
          <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">Import Transactions</h4>
          <p style="font-size: 0.76rem; color: var(--text-tertiary);">Import a Plutus CSV with Date, Type, Amount, and Account columns. Existing account names must match.</p>
          <input type="file" id="input-import-csv" accept=".csv,text/csv" style="display: none;">
          <button class="btn btn-secondary btn-sm" id="btn-trigger-csv-import" style="margin-top: auto;">Import CSV</button>
        </div>

        <div style="background: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px;">
          <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">Restore Backup</h4>
          <p style="font-size: 0.76rem; color: var(--text-tertiary);">Restore an encrypted backup created by this profile. Your current PIN is required.</p>
          <input type="file" id="input-import-json" accept=".json" style="display: none;">
          <button class="btn btn-secondary btn-sm" id="btn-trigger-import" style="margin-top: auto;">
            📂 Select File (.JSON)
          </button>
        </div>

        <div style="background: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px;">
          <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--rose-500);">Reset All Data</h4>
          <p style="font-size: 0.76rem; color: var(--text-tertiary);">Wipe all existing records to start completely fresh with a clean slate.</p>
          <button class="btn btn-danger btn-sm" id="btn-clear-all" style="margin-top: auto;">
            🗑️ Clear All Records
          </button>
        </div>
      </div>
    </div>
  `;

  // Compound Interest Calculation
  function computeCompound() {
    const P = parseFloat(document.getElementById('ci-initial').value) || 0;
    const PMT = parseFloat(document.getElementById('ci-monthly').value) || 0;
    const annualRate = (parseFloat(document.getElementById('ci-rate').value) || 0) / 100;
    const years = parseInt(document.getElementById('ci-years').value) || 1;

    const r = annualRate / 12;
    const n = years * 12;

    let fv = P * Math.pow(1 + r, n);
    if (r > 0) {
      fv += PMT * ((Math.pow(1 + r, n) - 1) / r);
    } else {
      fv += PMT * n;
    }

    const totalPrincipal = P + PMT * n;
    const totalInterest = Math.max(0, fv - totalPrincipal);

    const box = document.getElementById('ci-result-box');
    box.innerHTML = `
      <div class="calc-result-item">
        <span>Portfolio Value after <strong>${years} years</strong>:</span>
        <span class="calc-result-val">${store.formatMoney(Math.round(fv))}</span>
      </div>
      <div class="calc-result-item">
        <span>Total Principal Invested:</span>
        <strong style="color: var(--text-primary);">${store.formatMoney(Math.round(totalPrincipal))}</strong>
      </div>
      <div class="calc-result-item">
        <span>Compound Interest Earned:</span>
        <strong style="color: var(--emerald-500);">+${store.formatMoney(Math.round(totalInterest))} (${totalPrincipal > 0 ? (totalInterest / totalPrincipal * 100).toFixed(0) : 0}%)</strong>
      </div>
    `;
  }

  // Loan Calculation
  function computeLoan() {
    const principal = parseFloat(document.getElementById('loan-amount').value) || 0;
    const annualRate = (parseFloat(document.getElementById('loan-rate').value) || 0) / 100;
    const months = Math.max(1, parseInt(document.getElementById('loan-months').value) || 1);
    const method = document.getElementById('loan-method').value;

    const monthlyRate = annualRate / 12;
    let totalInterest = 0;
    let firstMonthPayment = 0;
    let paymentLabel = 'Monthly Payment:';
    const schedule = [];
    let balance = principal;

    if (method === 'annuity') {
      const pmt = monthlyRate > 0
        ? principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
        : principal / months;
      firstMonthPayment = pmt;
      for (let i = 1; i <= months; i++) {
        const interestPayment = balance * monthlyRate;
        const principalPayment = Math.min(balance, pmt - interestPayment);
        balance = Math.max(0, balance - principalPayment);
        totalInterest += interestPayment;
        schedule.push({ month: i, payment: pmt, principal: principalPayment, interest: interestPayment, balance });
      }
    } else if (method === 'reducing') {
      paymentLabel = 'First Month Payment:';
      const principalPerMonth = principal / months;
      firstMonthPayment = principalPerMonth + principal * monthlyRate;

      for (let i = 1; i <= months; i++) {
        const interestPayment = balance * monthlyRate;
        const payment = principalPerMonth + interestPayment;
        balance = Math.max(0, balance - principalPerMonth);
        totalInterest += interestPayment;
        schedule.push({ month: i, payment, principal: principalPerMonth, interest: interestPayment, balance });
      }
    } else {
      totalInterest = principal * annualRate * (months / 12);
      firstMonthPayment = (principal + totalInterest) / months;
      const principalPerMonth = principal / months;
      const interestPerMonth = totalInterest / months;
      for (let i = 1; i <= months; i++) {
        balance = Math.max(0, balance - principalPerMonth);
        schedule.push({ month: i, payment: firstMonthPayment, principal: principalPerMonth, interest: interestPerMonth, balance });
      }
    }

    const totalRepayment = principal + totalInterest;
    const previewRows = schedule.slice(0, 12);

    const box = document.getElementById('loan-result-box');
    box.innerHTML = `
      <div class="calc-result-item">
        <span>${paymentLabel}</span>
        <span class="calc-result-val">${store.formatMoney(Math.round(firstMonthPayment))} / mo</span>
      </div>
      <div class="calc-result-item">
        <span>Total Interest Paid:</span>
        <strong style="color: var(--rose-500);">${store.formatMoney(Math.round(totalInterest))}</strong>
      </div>
      <div class="calc-result-item">
        <span>Total Repayment (Principal + Interest):</span>
        <strong style="color: var(--text-primary);">${store.formatMoney(Math.round(totalRepayment))}</strong>
      </div>
      <details style="margin-top: 6px;">
        <summary style="font-size: 0.76rem; color: var(--text-secondary); cursor: pointer;">View amortization schedule (${months} months)</summary>
        <div style="max-height: 180px; overflow-y: auto; margin-top: 6px;">
          <table class="calc-breakdown-table">
            <thead>
              <tr><th>Mo</th><th>Payment</th><th>Principal</th><th>Interest</th><th>Balance</th></tr>
            </thead>
            <tbody>
              ${(schedule.length <= 60 ? schedule : previewRows).map(row => `
                <tr>
                  <td>#${row.month}</td>
                  <td>${store.formatMoney(Math.round(row.payment))}</td>
                  <td>${store.formatMoney(Math.round(row.principal))}</td>
                  <td>${store.formatMoney(Math.round(row.interest))}</td>
                  <td>${store.formatMoney(Math.round(row.balance))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </details>
    `;
  }

  computeCompound();
  computeLoan();

  document.getElementById('form-calc-compound').addEventListener('input', computeCompound);
  document.getElementById('form-calc-loan').addEventListener('input', computeLoan);

  // Backup & Restore Events
  document.getElementById('btn-export-backup').addEventListener('click', async () => {
    try {
      await store.exportJSON();
      toast.success('Encrypted backup downloaded.');
    } catch (error) {
      toast.error(error.message || 'Backup failed.');
    }
  });

  const fileInput = document.getElementById('input-import-json');
  document.getElementById('btn-trigger-import').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Backup is larger than the 2 MB safety limit.');
      fileInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        await store.importJSON(event.target.result);
        toast.success('Data restored successfully.');
        renderTools(container);
      } catch (error) {
        toast.error(error.message || 'Invalid encrypted backup.');
      }
    };
    reader.readAsText(file);
  });

  const csvInput = document.getElementById('input-import-csv');
  document.getElementById('btn-trigger-csv-import').addEventListener('click', () => csvInput.click());
  csvInput.addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('CSV is larger than the 2 MB safety limit.'); csvInput.value = ''; return; }
    const reader = new FileReader();
    reader.onload = result => {
      try {
        const summary = store.importCSV(result.target.result);
        toast.success(`Imported ${summary.imported} transaction(s)${summary.skipped ? `; skipped ${summary.skipped} invalid row(s)` : ''}.`);
      } catch (error) { toast.error(error.message || 'CSV import failed.'); }
      csvInput.value = '';
    };
    reader.readAsText(file);
  });

  document.getElementById('btn-clear-all').addEventListener('click', () => {
    modal.confirm({
      title: 'Clear Live Vault Records',
      message: 'This will clear all active transactions, budgets, goals, bills, debts, and accounts from your live vault (automatic encrypted backup files in your profile backups folder are retained). Continue?',
      confirmText: 'Clear Live Records',
      danger: true,
      onConfirm: () => {
        store.clearAll();
        toast.info('Live records cleared. Starting fresh.');
        renderTools(container);
      }
    });
  });
}
