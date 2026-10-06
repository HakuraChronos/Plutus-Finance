/* ==========================================================================
   PLUTUS FINANCE - FINANCIAL TOOLS & CALCULATORS VIEW (MINIMALIST / ENGLISH)
   ========================================================================== */

import { store } from '../state.js';
import { auth } from '../auth.js';
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
              <option value="reducing">Reducing Balance (Standard Banking)</option>
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
          <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">Restore Backup</h4>
          <p style="font-size: 0.76rem; color: var(--text-tertiary);">Restore an encrypted backup created by this profile. Your current PIN is required.</p>
          <input type="file" id="input-import-json" accept=".json" style="display: none;">
          <button class="btn btn-secondary btn-sm" id="btn-trigger-import" style="margin-top: auto;">
            📂 Select File (.JSON)
          </button>
        </div>

        <div id="legacy-recovery-card" style="display: none; background: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); flex-direction: column; gap: 8px;">
          <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">Recover Earlier Browser Vault</h4>
          <p style="font-size: 0.76rem; color: var(--text-tertiary);">Migrate the encrypted Chronos vault recovered from Brave. Enter the PIN you used before the security upgrade.</p>
          <input class="form-input" id="legacy-recovery-pin" type="password" inputmode="numeric" pattern="\\d{4,12}" minlength="4" maxlength="12" autocomplete="current-password" placeholder="Earlier vault PIN">
          <button class="btn btn-primary btn-sm" id="btn-recover-legacy" style="margin-top: auto;">
            Recover Missing Data
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
    const months = parseInt(document.getElementById('loan-months').value) || 1;
    const method = document.getElementById('loan-method').value;

    const monthlyRate = annualRate / 12;
    let totalInterest = 0;
    let firstMonthPayment = 0;

    if (method === 'reducing') {
      const principalPerMonth = principal / months;
      firstMonthPayment = principalPerMonth + principal * monthlyRate;

      for (let i = 0; i < months; i++) {
        const remainingPrincipal = principal - i * principalPerMonth;
        totalInterest += remainingPrincipal * monthlyRate;
      }
    } else {
      totalInterest = principal * annualRate * (months / 12);
      firstMonthPayment = (principal + totalInterest) / months;
    }

    const totalRepayment = principal + totalInterest;

    const box = document.getElementById('loan-result-box');
    box.innerHTML = `
      <div class="calc-result-item">
        <span>First Month Payment:</span>
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
    `;
  }

  computeCompound();
  computeLoan();

  document.getElementById('form-calc-compound').addEventListener('input', computeCompound);
  document.getElementById('form-calc-loan').addEventListener('input', computeLoan);

  auth.legacyRecoveryAvailable().then(available => {
    const card = document.getElementById('legacy-recovery-card');
    if (card && available) card.style.display = 'flex';
  });

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

  document.getElementById('btn-recover-legacy').addEventListener('click', async () => {
    const pinInput = document.getElementById('legacy-recovery-pin');
    const pin = pinInput.value.trim();
    try {
      const counts = await store.recoverLegacy(pin);
      pinInput.value = '';
      toast.success(`Recovered ${counts.transactions} transactions, ${counts.wallets} accounts, ${counts.budgets} budgets, and ${counts.goals} goals.`);
      renderTools(container);
    } catch (error) {
      pinInput.value = '';
      toast.error(error.message || 'Could not recover the earlier vault.');
    }
  });

  document.getElementById('btn-clear-all').addEventListener('click', () => {
    if (confirm('WARNING: This will permanently clear all transactions, budgets, goals, and accounts. Continue?')) {
      store.clearAll();
      toast.info('All records cleared. Starting fresh.');
      renderTools(container);
    }
  });
}
