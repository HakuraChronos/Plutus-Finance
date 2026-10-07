/* ==========================================================================
   PLUTUS FINANCE - DATA MODELS & CATEGORIES (MINIMALIST / ENGLISH)
   ========================================================================== */

export const CATEGORY_TYPES = {
  INCOME: 'income',
  EXPENSE: 'expense'
};

export const RULE_50_30_20 = {
  NEEDS: 'needs',     // 50% Essential Needs
  WANTS: 'wants',     // 30% Discretionary Wants
  SAVINGS: 'savings'  // 20% Savings & Debt Repayment
};

export const CATEGORIES = [
  // Income Sources
  { id: 'cat_salary', name: 'Salary & Wages', type: CATEGORY_TYPES.INCOME, icon: '💵', color: '#22c55e' },
  { id: 'cat_bonus', name: 'Bonus & Incentive', type: CATEGORY_TYPES.INCOME, icon: '🎉', color: '#16a34a' },
  { id: 'cat_freelance', name: 'Freelance & Side Gig', type: CATEGORY_TYPES.INCOME, icon: '💻', color: '#a1a1aa' },
  { id: 'cat_invest_return', name: 'Investment Returns', type: CATEGORY_TYPES.INCOME, icon: '📈', color: '#e4e4e7' },
  { id: 'cat_other_income', name: 'Other Income', type: CATEGORY_TYPES.INCOME, icon: '✨', color: '#71717a' },

  // Expenses - Essential Needs (50%)
  { id: 'cat_rent', name: 'Rent & Housing', type: CATEGORY_TYPES.EXPENSE, ruleGroup: RULE_50_30_20.NEEDS, icon: '🏠', color: '#e4e4e7' },
  { id: 'cat_utilities', name: 'Utilities & Bills', type: CATEGORY_TYPES.EXPENSE, ruleGroup: RULE_50_30_20.NEEDS, icon: '💡', color: '#a1a1aa' },
  { id: 'cat_groceries', name: 'Groceries & Essentials', type: CATEGORY_TYPES.EXPENSE, ruleGroup: RULE_50_30_20.NEEDS, icon: '🛒', color: '#22c55e' },
  { id: 'cat_transport', name: 'Transport & Fuel', type: CATEGORY_TYPES.EXPENSE, ruleGroup: RULE_50_30_20.NEEDS, icon: '⛽', color: '#71717a' },
  { id: 'cat_medical', name: 'Healthcare & Medical', type: CATEGORY_TYPES.EXPENSE, ruleGroup: RULE_50_30_20.NEEDS, icon: '💊', color: '#f43f5e' },
  { id: 'cat_education', name: 'Education & Learning', type: CATEGORY_TYPES.EXPENSE, ruleGroup: RULE_50_30_20.NEEDS, icon: '📚', color: '#a1a1aa' },

  // Expenses - Discretionary Wants (30%)
  { id: 'cat_dining', name: 'Dining Out & Cafes', type: CATEGORY_TYPES.EXPENSE, ruleGroup: RULE_50_30_20.WANTS, icon: '☕', color: '#eab308' },
  { id: 'cat_shopping', name: 'Shopping & Apparel', type: CATEGORY_TYPES.EXPENSE, ruleGroup: RULE_50_30_20.WANTS, icon: '🛍️', color: '#d4d4d8' },
  { id: 'cat_entertainment', name: 'Entertainment & Travel', type: CATEGORY_TYPES.EXPENSE, ruleGroup: RULE_50_30_20.WANTS, icon: '✈️', color: '#a1a1aa' },
  { id: 'cat_gadgets', name: 'Gadgets & Electronics', type: CATEGORY_TYPES.EXPENSE, ruleGroup: RULE_50_30_20.WANTS, icon: '📱', color: '#71717a' },
  { id: 'cat_beauty', name: 'Personal Care & Wellness', type: CATEGORY_TYPES.EXPENSE, ruleGroup: RULE_50_30_20.WANTS, icon: '✨', color: '#a1a1aa' },

  // Expenses - Savings & Debt Repayment (20%)
  { id: 'cat_savings_deposit', name: 'Savings & Emergency Fund', type: CATEGORY_TYPES.EXPENSE, ruleGroup: RULE_50_30_20.SAVINGS, icon: '🏦', color: '#22c55e' },
  { id: 'cat_invest_deposit', name: 'Investments (Stocks/Bonds)', type: CATEGORY_TYPES.EXPENSE, ruleGroup: RULE_50_30_20.SAVINGS, icon: '📊', color: '#e4e4e7' },
  { id: 'cat_debt_repay', name: 'Debt & Loan Repayment', type: CATEGORY_TYPES.EXPENSE, ruleGroup: RULE_50_30_20.SAVINGS, icon: '💳', color: '#f43f5e' }
];

export const WALLET_TYPES = {
  CASH: { id: 'cash', name: 'Cash', icon: '💵', class: 'wallet-card-cash' },
  BANK: { id: 'bank', name: 'Bank Account', icon: '🏛️', class: 'wallet-card-bank' },
  CREDIT: { id: 'credit', name: 'Credit Card', icon: '💳', class: 'wallet-card-credit' },
  EWALLET: { id: 'ewallet', name: 'Digital Wallet', icon: '📱', class: 'wallet-card-ewallet' },
  SAVINGS: { id: 'savings', name: 'Savings & Investment', icon: '🏦', class: 'wallet-card-savings' }
};

/**
 * Calculates Financial Health Score (0 - 100)
 */
export function calculateFinancialHealthScore({ totalIncome, totalExpense, totalLiquidAssets, monthlyNeeds, creditCardDebt, creditLimit }) {
  if (!totalIncome || totalIncome <= 0) {
    return {
      score: null,
      label: 'Not enough data',
      color: '#71717a',
      advice: 'Record your monthly income and expenses to assess your financial health score.'
    };
  }

  let score = 50; // Baseline

  // 1. Savings Rate = (Income - Expense) / Income
  const savingsRate = (totalIncome - totalExpense) / totalIncome;
  if (savingsRate >= 0.30) score += 20;
  else if (savingsRate >= 0.20) score += 15;
  else if (savingsRate >= 0.10) score += 8;
  else if (savingsRate < 0) score -= 20; // Deficit

  // 2. Emergency Runway = Liquid Assets / Monthly Essential Needs
  const monthlyBurn = monthlyNeeds > 0 ? monthlyNeeds : (totalExpense > 0 ? totalExpense : 10000);
  const emergencyMonths = monthlyBurn > 0 ? totalLiquidAssets / monthlyBurn : 0;
  if (emergencyMonths >= 6) score += 20;
  else if (emergencyMonths >= 3) score += 12;
  else if (emergencyMonths >= 1) score += 5;
  else score -= 10;

  // 3. Credit Card Utilization Rate
  if (creditLimit && creditLimit > 0) {
    const utilRate = creditCardDebt / creditLimit;
    if (utilRate === 0) score += 10;
    else if (utilRate <= 0.30) score += 10;
    else if (utilRate > 0.70) score -= 15;
  } else {
    score += 10;
  }

  score = Math.max(10, Math.min(100, Math.round(score)));

  let label = 'Good';
  let color = '#22c55e';
  let advice = 'Solid cash flow and savings discipline. Keep growing your reserves and investments.';

  if (score >= 85) {
    label = 'Excellent';
    color = '#22c55e';
    advice = 'Outstanding! Strong surplus cash flow and healthy emergency runway over 6 months.';
  } else if (score >= 70) {
    label = 'Good';
    color = '#38bdf8';
    advice = 'Healthy financial discipline with consistent positive monthly savings.';
  } else if (score >= 50) {
    label = 'Fair';
    color = '#eab308';
    advice = 'Consider building a larger emergency fund and trimming discretionary expenses.';
  } else {
    label = 'Needs Attention';
    color = '#f43f5e';
    advice = 'Negative cash flow or high credit utilization detected. Review non-essential expenses.';
  }

  return { score, label, color, advice, savingsRate, emergencyMonths };
}
