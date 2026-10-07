import { CATEGORIES, RULE_50_30_20 } from '../models.js';
import { calendarDaysBetween, endOfLocalMonth, localDateKey, localMonthKey } from './dates.js';

const sum = values => values.reduce((total, value) => total + value, 0);

export function allocationTargets(settings = {}) {
  const saved = settings.allocationTargets || {};
  const needs = Number(saved.needs);
  const wants = Number(saved.wants);
  const savings = Number(saved.savings);
  if ([needs, wants, savings].every(Number.isFinite) && needs >= 0 && wants >= 0 && savings >= 0 && Math.abs(needs + wants + savings - 100) < 0.001) {
    return { needs, wants, savings };
  }
  return { needs: 50, wants: 30, savings: 20 };
}

export function monthlyActivity(state, now = new Date()) {
  const month = localMonthKey(now);
  const transactions = state.transactions.filter(item => item.date?.startsWith(month));
  const income = sum(transactions.filter(item => item.type === 'income').map(item => Number(item.amount) || 0));
  const expense = sum(transactions.filter(item => item.type === 'expense').map(item => Number(item.amount) || 0));
  const groups = { needs: 0, wants: 0, savings: 0 };
  const categories = {};

  transactions.filter(item => item.type === 'expense').forEach(item => {
    const amount = Number(item.amount) || 0;
    const category = CATEGORIES.find(entry => entry.id === item.categoryId);
    const group = category?.ruleGroup || RULE_50_30_20.WANTS;
    groups[group] += amount;
    categories[item.categoryId || 'other'] = (categories[item.categoryId || 'other'] || 0) + amount;
  });

  return { month, transactions, income, expense, surplus: income - expense, groups, categories };
}

export function dueCommitments(state, now = new Date()) {
  const today = localDateKey(now);
  const monthEnd = endOfLocalMonth(now);
  const bills = (state.bills || []).filter(item => item.active !== false && item.nextDue <= monthEnd);
  const debts = (state.debts || []).filter(item => item.active !== false && item.kind === 'owed' && item.balance > 0 && item.nextDue <= monthEnd);
  return {
    today,
    monthEnd,
    bills,
    debts,
    billReserve: sum(bills.map(item => Number(item.amount) || 0)),
    debtReserve: sum(debts.map(item => Math.min(Number(item.minimumPayment) || 0, Number(item.balance) || 0)))
  };
}

export function calculatePlanningSummary(state, now = new Date()) {
  const activity = monthlyActivity(state, now);
  const due = dueCommitments(state, now);
  const targets = allocationTargets(state.settings);
  const liquidBalance = sum(state.wallets.filter(wallet => wallet.type !== 'credit').map(wallet => Math.max(0, Number(wallet.balance) || 0)));
  const savingsReserve = Math.max(0, activity.income * targets.savings / 100 - activity.groups.savings);
  const safeToSpend = liquidBalance - due.billReserve - due.debtReserve - savingsReserve;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsedDays = Math.max(1, now.getDate());
  const remainingDays = Math.max(0, daysInMonth - elapsedDays);
  const projectedIncome = activity.income / elapsedDays * remainingDays;
  const projectedVariableExpense = activity.expense / elapsedDays * remainingDays;
  const forecastBalance = liquidBalance + projectedIncome - projectedVariableExpense - due.billReserve - due.debtReserve;

  return { activity, due, targets, liquidBalance, savingsReserve, safeToSpend, projectedIncome, projectedVariableExpense, forecastBalance };
}

export function spendingAlerts(state, now = new Date()) {
  const activity = monthlyActivity(state, now);
  const threshold = Math.min(100, Math.max(1, Number(state.settings?.spendingAlertPercent) || 85));
  const alerts = [];

  (state.budgets || []).forEach(budget => {
    const spent = activity.categories[budget.categoryId] || 0;
    const limit = Number(budget.limit) || 0;
    if (limit <= 0) return;
    const percent = Math.round(spent / limit * 100);
    if (percent >= threshold) {
      const category = CATEGORIES.find(item => item.id === budget.categoryId);
      alerts.push({ type: 'budget', severity: percent >= 100 ? 'danger' : 'warning', title: `${category?.name || 'Category'} budget`, message: `${percent}% used (${spent} of ${limit})`, percent });
    }
  });

  const today = localDateKey(now);
  (state.bills || []).filter(item => item.active !== false).forEach(bill => {
    const days = calendarDaysBetween(today, bill.nextDue);
    if (days !== null && days <= 7) {
      alerts.push({ type: 'bill', severity: days < 0 ? 'danger' : 'warning', title: bill.name, message: days < 0 ? `${Math.abs(days)} day(s) overdue` : days === 0 ? 'Due today' : `Due in ${days} day(s)`, days });
    }
  });

  const expenses = state.transactions.filter(item => item.type === 'expense');
  activity.transactions.filter(item => item.type === 'expense').forEach(transaction => {
    const history = expenses.filter(item => item.id !== transaction.id && item.categoryId === transaction.categoryId).map(item => Number(item.amount) || 0).filter(amount => amount > 0);
    if (history.length < 3) return;
    const average = sum(history) / history.length;
    if (transaction.amount >= average * 2 && transaction.amount > average) {
      const category = CATEGORIES.find(item => item.id === transaction.categoryId);
      alerts.push({ type: 'unusual', severity: 'warning', title: `Unusual ${category?.name || 'expense'}`, message: `${Math.round(transaction.amount / average * 100)}% of the usual amount`, transactionId: transaction.id });
    }
  });

  return alerts.sort((a, b) => (a.severity === 'danger' ? -1 : 1) - (b.severity === 'danger' ? -1 : 1));
}
