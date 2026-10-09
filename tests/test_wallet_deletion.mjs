import assert from 'node:assert/strict';
import { StateStore } from '../app/js/state.js';

const store = new StateStore();
let saveCalls = 0;
store.save = () => { saveCalls += 1; };
store.state = {
  ...store.getEmptyDataset(),
  wallets: [
    { id: 'linked', name: 'Linked account', type: 'bank', balance: 1000 },
    { id: 'clean', name: 'Clean account', type: 'cash', balance: 50 }
  ],
  transactions: [
    { id: 'income', type: 'income', walletId: 'linked', toWalletId: null, amount: 100 },
    { id: 'expense', type: 'expense', walletId: 'linked', toWalletId: null, amount: 25 },
    { id: 'transfer-out', type: 'transfer', walletId: 'linked', toWalletId: 'clean', amount: 10 },
    { id: 'transfer-in', type: 'transfer', walletId: 'clean', toWalletId: 'linked', amount: 5 }
  ],
  bills: [
    { id: 'active-bill', walletId: 'linked', active: true },
    { id: 'inactive-bill', walletId: 'linked', active: false }
  ],
  debts: [
    { id: 'debt', kind: 'owed', walletId: 'linked', active: true },
    { id: 'paid-debt', kind: 'receivable', walletId: 'linked', active: false }
  ]
};

const dependencies = store.getWalletDependencies('linked');
assert.equal(dependencies.transactions.length, 2, 'income and expense records must be reported');
assert.equal(dependencies.transfers.length, 2, 'incoming and outgoing transfers must be reported once each');
assert.equal(dependencies.bills.length, 2, 'active and inactive bills must be reported');
assert.equal(dependencies.debts.length, 2, 'active and inactive debts or receivables must be reported');
assert.equal(dependencies.total, 8);

const beforeBlockedDelete = JSON.parse(JSON.stringify(store.state));
const blocked = store.deleteWallet('linked');
assert.equal(blocked.deleted, false);
assert.equal(blocked.reason, 'dependencies');
assert.equal(blocked.dependencies.total, 8);
assert.deepEqual(store.state, beforeBlockedDelete, 'blocked deletion must preserve every record');
assert.equal(saveCalls, 0, 'blocked deletion must not queue a save');

store.state.transactions = store.state.transactions.filter(item => item.walletId !== 'clean' && item.toWalletId !== 'clean');
const recordsBeforeCleanDelete = {
  transactions: JSON.parse(JSON.stringify(store.state.transactions)),
  bills: JSON.parse(JSON.stringify(store.state.bills)),
  debts: JSON.parse(JSON.stringify(store.state.debts))
};
const deleted = store.deleteWallet('clean');
assert.equal(deleted.deleted, true);
assert.equal(deleted.reason, null);
assert.equal(deleted.dependencies.total, 0);
assert.equal(store.state.wallets.some(wallet => wallet.id === 'clean'), false);
assert.deepEqual(store.state.transactions, recordsBeforeCleanDelete.transactions);
assert.deepEqual(store.state.bills, recordsBeforeCleanDelete.bills);
assert.deepEqual(store.state.debts, recordsBeforeCleanDelete.debts);
assert.equal(saveCalls, 1, 'successful deletion must queue exactly one save');

const beforeMissingDelete = JSON.parse(JSON.stringify(store.state));
const missing = store.deleteWallet('missing');
assert.equal(missing.deleted, false);
assert.equal(missing.reason, 'not_found');
assert.deepEqual(store.state, beforeMissingDelete);
assert.equal(saveCalls, 1, 'missing account must not queue a save');

console.log('Wallet deletion referential integrity: PASS');
