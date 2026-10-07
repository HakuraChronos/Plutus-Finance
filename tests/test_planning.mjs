import assert from 'node:assert/strict';
import { advanceDateKey } from '../app/js/utils/dates.js';
import { calculatePlanningSummary, spendingAlerts } from '../app/js/utils/planning.js';
import { csvRecords, parseCsv } from '../app/js/utils/csv.js';
import { StateStore } from '../app/js/state.js';

process.env.TZ = 'Asia/Taipei';

assert.equal(advanceDateKey('2026-01-31', 'monthly'), '2026-02-28');
assert.equal(advanceDateKey('2027-01-31', 'monthly'), '2027-02-28');
assert.equal(advanceDateKey('2024-02-29', 'yearly'), '2025-02-28');

const state = {
  settings: { allocationTargets: { needs: 50, wants: 30, savings: 20 }, spendingAlertPercent: 85 },
  wallets: [{ id: 'bank', type: 'bank', balance: 10000 }],
  transactions: [
    { id: 'income', date: '2026-10-02', type: 'income', amount: 5000, categoryId: 'cat_salary' },
    { id: 'rent', date: '2026-10-03', type: 'expense', amount: 1000, categoryId: 'cat_rent' },
    { id: 'saving', date: '2026-10-04', type: 'expense', amount: 500, categoryId: 'cat_savings_deposit' }
  ],
  budgets: [{ categoryId: 'cat_rent', limit: 1100 }],
  bills: [{ id: 'bill', name: 'Internet', amount: 1200, nextDue: '2026-10-12', active: true }],
  debts: [{ id: 'debt', kind: 'owed', balance: 2000, minimumPayment: 300, nextDue: '2026-10-20', active: true }]
};

const summary = calculatePlanningSummary(state, new Date(2026, 9, 10, 12));
assert.equal(summary.due.billReserve, 1200);
assert.equal(summary.due.debtReserve, 300);
assert.equal(summary.savingsReserve, 500);
assert.equal(summary.safeToSpend, 8000);
assert.equal(summary.forecastBalance, 15850);

const alerts = spendingAlerts(state, new Date(2026, 9, 10, 12));
assert.ok(alerts.some(alert => alert.type === 'budget' && alert.percent === 91));
assert.ok(alerts.some(alert => alert.type === 'bill' && alert.days === 2));

assert.deepEqual(parseCsv('A,B\n"x,y","say ""hi"""\n'), [['A', 'B'], ['x,y', 'say "hi"']]);
assert.deepEqual(csvRecords('Date,Type,Amount,Account\n2026-10-07,expense,25,Cash\n')[0], {
  date: '2026-10-07', type: 'expense', amount: '25', account: 'Cash'
});
assert.throws(() => csvRecords('Date,Amount\n2026-10-07,25\n'), /requires Date, Type, Amount, and Account/);

const legacyStore = new StateStore();
const migrated = legacyStore.validateDataset({
  settings: { currency: 'TWD', stealthMode: false, theme: 'dark' },
  wallets: [], transactions: [], budgets: [], goals: []
});
assert.deepEqual(migrated.bills, []);
assert.deepEqual(migrated.debts, []);
assert.deepEqual(migrated.settings.allocationTargets, { needs: 50, wants: 30, savings: 20 });

legacyStore.state = legacyStore.getEmptyDataset();
legacyStore.state.wallets.push({ id: 'cash', name: 'Cash', type: 'cash', balance: 5000 });
const bill = legacyStore.addBill({ name: 'Rent', amount: 1000, nextDue: '2026-01-31', frequency: 'monthly', walletId: 'cash', categoryId: 'cat_rent' });
assert.equal(legacyStore.payBill(bill.id), true);
assert.equal(bill.nextDue, '2026-02-28');
assert.equal(legacyStore.state.wallets[0].balance, 4000);
assert.equal(legacyStore.state.transactions[0].note, 'Bill: Rent');

const debt = legacyStore.addDebt({ name: 'Loan', kind: 'owed', balance: 2000, minimumPayment: 300, nextDue: '2026-02-28', walletId: 'cash' });
assert.equal(legacyStore.recordDebtPayment(debt.id, 300), true);
assert.equal(debt.balance, 1700);
assert.equal(debt.nextDue, '2026-03-28');
assert.equal(legacyStore.state.wallets[0].balance, 3700);
assert.equal(legacyStore.state.transactions[0].categoryId, 'cat_debt_repay');

console.log('Planning, commitments, CSV, and legacy migration: PASS');
