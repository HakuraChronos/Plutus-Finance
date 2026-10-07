import { store } from '../state.js';
import { CATEGORIES, CATEGORY_TYPES } from '../models.js';
import { toast } from '../components/toast.js';
import { escapeHtml } from '../utils/security.js';
import { calendarDaysBetween, localDateKey } from '../utils/dates.js';

const dueLabel = (date, today) => {
  const days = calendarDaysBetween(today, date);
  if (days === null) return 'Invalid date';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `Due in ${days}d`;
};

export function renderCommitments(container) {
  const { bills, debts, wallets } = store.state;
  const today = localDateKey();
  const expenseCategories = CATEGORIES.filter(item => item.type === CATEGORY_TYPES.EXPENSE);
  const walletOptions = wallets.map(wallet => `<option value="${escapeHtml(wallet.id)}">${escapeHtml(wallet.name)}</option>`).join('');
  const activeBills = bills.filter(item => item.active !== false).sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  const activeDebts = debts.filter(item => item.active !== false && item.balance > 0).sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  const billTotal = activeBills.reduce((sum, item) => sum + item.amount, 0);
  const owed = activeDebts.filter(item => item.kind === 'owed').reduce((sum, item) => sum + item.balance, 0);
  const receivable = activeDebts.filter(item => item.kind === 'receivable').reduce((sum, item) => sum + item.balance, 0);

  container.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><span class="stat-label">Recurring commitments</span><span class="stat-value privacy-sensitive">${store.formatMoney(billTotal)}</span><span class="stat-footer">${activeBills.length} active bill(s)</span></div>
      <div class="stat-card"><span class="stat-label">Debt outstanding</span><span class="stat-value privacy-sensitive" style="color: var(--rose-500);">${store.formatMoney(owed)}</span><span class="stat-footer">Money you owe</span></div>
      <div class="stat-card"><span class="stat-label">Money owed to you</span><span class="stat-value privacy-sensitive" style="color: var(--emerald-500);">${store.formatMoney(receivable)}</span><span class="stat-footer">Open receivables</span></div>
    </div>

    <div class="commitment-layout">
      <section class="card">
        <div class="card-header"><div><h3 class="card-title">Bills & subscriptions</h3><p class="card-subtitle">Recurring payments and upcoming due dates</p></div></div>
        <form id="form-add-bill" class="compact-form">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="bill-name" maxlength="80" placeholder="Internet, rent, streaming…" required></div>
            <div class="form-group"><label class="form-label">Amount</label><input class="form-input" id="bill-amount" type="number" min="0.01" step="any" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Next due</label><input class="form-input" id="bill-due" type="date" value="${today}" required></div>
            <div class="form-group"><label class="form-label">Repeats</label><select class="form-select" id="bill-frequency"><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Category</label><select class="form-select" id="bill-category">${expenseCategories.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Pay from</label><select class="form-select" id="bill-wallet" required><option value="">Select account</option>${walletOptions}</select></div>
          </div>
          <button class="btn btn-primary btn-sm" type="submit" ${wallets.length ? '' : 'disabled'}>Add recurring bill</button>
          ${wallets.length ? '' : '<p class="form-hint">Create an account before adding a payable bill.</p>'}
        </form>
        <div class="commitment-list">
          ${activeBills.length ? activeBills.map(item => {
            const overdue = item.nextDue < today;
            return `<article class="commitment-item">
              <div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.frequency)} · ${escapeHtml(item.nextDue)} · <em class="${overdue ? 'due-danger' : ''}">${dueLabel(item.nextDue, today)}</em></span></div>
              <div class="commitment-actions"><strong class="privacy-sensitive">${store.formatMoney(item.amount)}</strong><button class="btn btn-primary btn-sm bill-pay" data-id="${escapeHtml(item.id)}">Mark paid</button><button class="btn btn-danger btn-sm bill-delete" data-id="${escapeHtml(item.id)}">Delete</button></div>
            </article>`;
          }).join('') : '<div class="empty-inline">No recurring bills yet.</div>'}
        </div>
      </section>

      <section class="card">
        <div class="card-header"><div><h3 class="card-title">Debt & loans</h3><p class="card-subtitle">Track repayments and money people owe you</p></div></div>
        <form id="form-add-debt" class="compact-form">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="debt-name" maxlength="80" placeholder="Student loan, Alex…" required></div>
            <div class="form-group"><label class="form-label">Direction</label><select class="form-select" id="debt-kind"><option value="owed">I owe money</option><option value="receivable">Owed to me</option></select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Balance</label><input class="form-input" id="debt-balance" type="number" min="0.01" step="any" required></div>
            <div class="form-group"><label class="form-label">APR %</label><input class="form-input" id="debt-rate" type="number" min="0" step="0.01" value="0"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Monthly payment</label><input class="form-input" id="debt-payment" type="number" min="0" step="any" value="0"></div>
            <div class="form-group"><label class="form-label">Next due</label><input class="form-input" id="debt-due" type="date" value="${today}" required></div>
          </div>
          <div class="form-group"><label class="form-label">Linked account</label><select class="form-select" id="debt-wallet" required><option value="">Select account</option>${walletOptions}</select></div>
          <button class="btn btn-primary btn-sm" type="submit" ${wallets.length ? '' : 'disabled'}>Add debt or receivable</button>
        </form>
        <div class="commitment-list">
          ${activeDebts.length ? activeDebts.map(item => `<article class="commitment-item">
            <div><strong>${escapeHtml(item.name)}</strong><span>${item.kind === 'receivable' ? 'Owed to you' : 'You owe'} · ${Number(item.interestRate).toFixed(2)}% APR · ${escapeHtml(item.nextDue)}</span></div>
            <div class="commitment-actions"><strong class="privacy-sensitive">${store.formatMoney(item.balance)}</strong><button class="btn btn-primary btn-sm debt-pay" data-id="${escapeHtml(item.id)}">Record payment</button><button class="btn btn-danger btn-sm debt-delete" data-id="${escapeHtml(item.id)}">Delete</button></div>
          </article>`).join('') : '<div class="empty-inline">No debts or receivables yet.</div>'}
        </div>
      </section>
    </div>
  `;

  document.getElementById('form-add-bill').addEventListener('submit', event => {
    event.preventDefault();
    try {
      store.addBill({ name: document.getElementById('bill-name').value, amount: store.toBaseAmount(document.getElementById('bill-amount').value), nextDue: document.getElementById('bill-due').value, frequency: document.getElementById('bill-frequency').value, categoryId: document.getElementById('bill-category').value, walletId: document.getElementById('bill-wallet').value });
      toast.success('Recurring bill added.');
    } catch (error) { toast.error(error.message); }
  });

  document.getElementById('form-add-debt').addEventListener('submit', event => {
    event.preventDefault();
    try {
      store.addDebt({ name: document.getElementById('debt-name').value, kind: document.getElementById('debt-kind').value, balance: store.toBaseAmount(document.getElementById('debt-balance').value), interestRate: document.getElementById('debt-rate').value, minimumPayment: store.toBaseAmount(document.getElementById('debt-payment').value), nextDue: document.getElementById('debt-due').value, walletId: document.getElementById('debt-wallet').value });
      toast.success('Debt record added.');
    } catch (error) { toast.error(error.message); }
  });

  container.querySelectorAll('.bill-pay').forEach(button => button.addEventListener('click', () => {
    if (store.payBill(button.dataset.id)) toast.success('Bill paid and transaction recorded.');
    else toast.error('Choose a linked account before recording payment.');
  }));
  container.querySelectorAll('.bill-delete').forEach(button => button.addEventListener('click', () => { if (confirm('Delete this recurring bill?')) store.deleteBill(button.dataset.id); }));
  container.querySelectorAll('.debt-pay').forEach(button => button.addEventListener('click', () => {
    const debt = store.state.debts.find(item => item.id === button.dataset.id);
    const suggested = store.fromBaseAmount(Math.min(debt.minimumPayment || debt.balance, debt.balance));
    const amount = prompt(`Payment amount (${store.currentCurrency.code})`, String(suggested));
    if (amount === null) return;
    if (store.recordDebtPayment(button.dataset.id, store.toBaseAmount(amount))) toast.success('Payment recorded and balance updated.');
    else toast.error('Enter a positive payment and select a linked account.');
  }));
  container.querySelectorAll('.debt-delete').forEach(button => button.addEventListener('click', () => { if (confirm('Delete this debt record?')) store.deleteDebt(button.dataset.id); }));
}
