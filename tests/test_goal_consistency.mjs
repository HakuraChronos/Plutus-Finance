import assert from 'node:assert/strict';
import { StateStore } from '../app/js/state.js';

const trackedStore = () => {
  const store = new StateStore();
  let saveCalls = 0;
  store.save = () => { saveCalls += 1; };
  return { store, saveCalls: () => saveCalls };
};

const { store, saveCalls } = trackedStore();
store.state = store.getEmptyDataset();
store.state.wallets.push({ id: 'cash', name: 'Cash', type: 'cash', balance: 1000 });

const goal = store.addGoal({ title: 'Emergency fund', targetAmount: 1000, currentAmount: 50, deadline: '2027-12-31' });
assert.equal(goal.startingAmount, 50);
assert.equal(store.getGoalBalance(goal), 50);
assert.equal(saveCalls(), 1);

assert.equal(store.depositGoal(goal.id, 100, 'cash'), true);
const firstDeposit = store.state.transactions[0];
assert.equal(firstDeposit.goalId, goal.id);
assert.equal(firstDeposit.type, 'expense');
assert.equal(firstDeposit.categoryId, 'cat_savings_deposit');
assert.equal(store.state.wallets[0].balance, 900);
assert.equal(store.getGoalBalance(goal), 150);
assert.equal(goal.currentAmount, 150);
assert.equal(saveCalls(), 2, 'one deposit must queue exactly one save');

assert.equal(store.depositGoal(goal.id, 25, 'cash'), true);
const secondDeposit = store.state.transactions[0];
assert.notEqual(secondDeposit.id, firstDeposit.id);
assert.equal(store.getGoalBalance(goal), 175, 'distinct deposits must each count once');
assert.equal(store.state.wallets[0].balance, 875);

assert.equal(store.updateGoalDepositAmount(firstDeposit.id, 60), true);
assert.equal(firstDeposit.amount, 60);
assert.equal(store.state.wallets[0].balance, 915, 'editing must apply only the amount difference');
assert.equal(store.getGoalBalance(goal), 135);

assert.equal(store.deleteTransaction(firstDeposit.id), true);
assert.equal(store.state.wallets[0].balance, 975);
assert.equal(store.getGoalBalance(goal), 75);
assert.equal(goal.currentAmount, 75);

const unrelated = {
  id: 'ordinary-expense', type: 'expense', amount: 5, categoryId: 'cat_shopping',
  walletId: 'cash', toWalletId: null, note: 'Unrelated'
};
store.state.transactions.push(unrelated);
const balanceBeforeUnrelatedDelete = store.getGoalBalance(goal);
assert.equal(store.deleteTransaction(unrelated.id), true);
assert.equal(store.getGoalBalance(goal), balanceBeforeUnrelatedDelete, 'ordinary transaction deletion must not alter goals');

const stateBeforeInvalidDeposit = JSON.parse(JSON.stringify(store.state));
const savesBeforeInvalidDeposit = saveCalls();
assert.equal(store.depositGoal(goal.id, 10, 'missing-wallet'), false);
assert.deepEqual(store.state, stateBeforeInvalidDeposit, 'missing wallet must not cause partial mutation');
assert.equal(store.depositGoal('missing-goal', 10, 'cash'), false);
assert.deepEqual(store.state, stateBeforeInvalidDeposit, 'missing goal must not cause partial mutation');
assert.equal(saveCalls(), savesBeforeInvalidDeposit);

const transactionsBeforeGoalDelete = JSON.parse(JSON.stringify(store.state.transactions));
const walletBeforeGoalDelete = store.state.wallets[0].balance;
store.deleteGoal(goal.id);
assert.equal(store.state.goals.length, 0);
assert.deepEqual(store.state.transactions, transactionsBeforeGoalDelete, 'goal deletion must preserve transaction history');
assert.equal(store.state.wallets[0].balance, walletBeforeGoalDelete, 'goal deletion must not change account balances');
const stateBeforeOrphanEdit = JSON.parse(JSON.stringify(store.state));
const savesBeforeOrphanEdit = saveCalls();
assert.equal(store.updateGoalDepositAmount(secondDeposit.id, 30), false, 'missing goal reference must reject deposit editing');
assert.deepEqual(store.state, stateBeforeOrphanEdit);
assert.equal(store.updateGoalDepositAmount('missing-transaction', 30), false);
assert.deepEqual(store.state, stateBeforeOrphanEdit);
assert.equal(saveCalls(), savesBeforeOrphanEdit);

const legacyStore = new StateStore();
const legacy = legacyStore.validateDataset({
  settings: { currency: 'TWD', stealthMode: false, theme: 'dark' },
  wallets: [{ id: 'legacy-cash', balance: 500 }],
  transactions: [{
    id: 'legacy-note', type: 'expense', amount: 100, categoryId: 'cat_savings_deposit',
    walletId: 'legacy-cash', note: 'Deposit to goal: Legacy goal'
  }],
  budgets: [],
  goals: [{ id: 'legacy-goal', title: 'Legacy goal', targetAmount: 1000, currentAmount: 400 }]
});
legacyStore.state = legacy;
assert.equal(legacyStore.getGoalBalance('legacy-goal'), 400, 'legacy balance must remain unchanged');
assert.equal(Object.hasOwn(legacy.goals[0], 'startingAmount'), false, 'legacy records must not be silently linked by note');

const restored = legacyStore.validateDataset({
  settings: { currency: 'TWD', stealthMode: false, theme: 'dark' },
  wallets: [], budgets: [], bills: [], debts: [],
  goals: [{ id: 'restored-goal', title: 'Restored', targetAmount: 500, startingAmount: 100, currentAmount: 999 }],
  transactions: [
    { id: 'deposit-1', type: 'expense', amount: 50, goalId: 'restored-goal' },
    { id: 'deposit-1', type: 'expense', amount: 50, goalId: 'restored-goal' },
    { id: 'deposit-2', type: 'expense', amount: 25, goalId: 'restored-goal' },
    { id: 'not-a-deposit', type: 'income', amount: 100, goalId: 'restored-goal' }
  ]
});
assert.equal(restored.goals[0].currentAmount, 175, 'new-format restore must reconcile from unique linked expenses');

const { store: missingReferenceStore, saveCalls: missingReferenceSaves } = trackedStore();
missingReferenceStore.state = missingReferenceStore.getEmptyDataset();
missingReferenceStore.state.wallets.push({ id: 'bank', balance: 80 });
missingReferenceStore.state.transactions.push({ id: 'orphan', type: 'expense', amount: 20, walletId: 'bank', goalId: 'deleted-goal' });
assert.equal(missingReferenceStore.deleteTransaction('orphan'), true);
assert.equal(missingReferenceStore.state.wallets[0].balance, 100, 'missing goal must not prevent wallet reversal');
assert.equal(missingReferenceSaves(), 1);

const { store: overdraftStore, saveCalls: overdraftSaves } = trackedStore();
overdraftStore.state = overdraftStore.getEmptyDataset();
overdraftStore.state.wallets.push({ id: 'small', balance: 10 });
const overdraftGoal = overdraftStore.addGoal({ title: 'Large goal', targetAmount: 100, currentAmount: 0 });
const savesBeforeOverdraft = overdraftSaves();
assert.equal(overdraftStore.depositGoal(overdraftGoal.id, 20, 'small'), true);
assert.equal(overdraftStore.state.wallets[0].balance, -10, 'goal deposits preserve the existing negative-balance policy');
assert.equal(overdraftStore.getGoalBalance(overdraftGoal), 20);
assert.equal(overdraftSaves(), savesBeforeOverdraft + 1);
const transactionCount = overdraftStore.state.transactions.length;
overdraftStore.save();
assert.equal(overdraftStore.state.transactions.length, transactionCount, 'repeated saves must not create duplicate deposits');

console.log('Goal deposit consistency and reconciliation: PASS');
