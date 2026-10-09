# Plutus features

This list is based on the application source, not on planned features.

## Access and privacy

- **Animated opening and login:** the logo/wordmark appears first, then shifts to
  the left while the login form appears. Reduced-motion users skip the timed
  animation.
- **Private profiles:** users type a username and PIN rather than selecting a
  visible profile. New usernames must start with a letter and contain 2–32
  allowed characters. New PINs are 6–12 digits; older migrated profiles may
  unlock with 4–12 digits.
- **Encrypted vault:** each profile has its own PIN-derived AES-GCM vault.
- **Sign out:** waits for queued saves, clears decrypted in-memory state, and
  returns to the login screen.
- **Stealth mode:** hides elements marked as privacy-sensitive. The toolbar
  button or `H` key toggles it, and the preference is saved in the vault.
- **Save status:** the top bar reports saving, saved, or disk-save failure.

Profile names are not rendered before login, but public profile metadata is
loaded from the local server and cached in the WebView/browser storage. The
financial dataset stays encrypted at rest.

## Accounts and transactions

### Accounts

Users can create cash, bank, credit-card, digital-wallet, and
savings/investment accounts. Each account stores a name, type, balance, optional
credit limit, optional account/card number, and icon.

The Accounts screen totals liquid assets, savings/investments, credit-card debt,
and credit limits. It also starts account-to-account transfers.

An account can be deleted only when no transaction, incoming or outgoing
transfer, bill, debt, or receivable references it. When deletion is blocked, the
Accounts screen reports how many records of each type are affected. Plutus does
not automatically delete or reassign those records.

### Transactions

Users can record income, expenses, and transfers with amount, date, account,
category, and note. Transactions can be searched by note/category and filtered
by type, account, and category. The current filter also shows income, expense,
and net totals.

Creating a transaction immediately changes account balances:

- Income adds to the source account.
- Expense subtracts from it.
- Transfer subtracts from the source and adds to the destination.
- Deleting a transaction reverses the same effects when the referenced accounts
  still exist.

There is no edit operation. A wrong transaction must be deleted and recreated.

## Budgets and alerts

Users set one monthly limit per expense category. The budget screen compares
current-local-month expenses with each limit, shows remaining money, marks near
or exceeded limits, and calculates a per-day allowance for the remaining days
of the month.

The dashboard alert threshold is configurable from 1% to 100% (85% by default).
Alerts include:

- Category budget usage at or above the threshold.
- Active bills due within seven days or already overdue.
- A current-month expense at least twice the average of three or more other
  expenses in the same category.

Recording an expense from the modal also produces an immediate 85%/100% budget
toast. That modal threshold is fixed at 85%, while dashboard alerts use the
custom setting.

## Savings goals

Users create goals with a target, starting saved amount, deadline, and icon. The
Goals screen shows total target, total accumulated, remaining amount, percentage
complete, and an approximate monthly contribution needed.

Depositing to a goal increases its saved amount and creates a categorized
expense in the selected account. That expense also affects account balance,
monthly cash flow, the Savings allocation group, budgets/alerts if applicable,
and dashboard calculations. New deposits carry the goal's stable ID. Editing a
linked deposit amount in the state layer applies only the difference, and
deleting its transaction reverses both the account effect and goal contribution.

Deleting a goal does not delete or alter its historical transactions or account
balances. A later deletion of one of those transactions still reverses its
account effect safely, even though the goal no longer exists. Existing goals
from older releases retain their stored balance; Plutus does not guess links
from transaction-note text.

## Bills, subscriptions, debt, and receivables

### Recurring bills

Users add monthly or yearly bills with an amount, next due date, expense
category, and payment account. Marking a bill paid advances its due date one
period and creates an expense transaction dated today.

The app does not accrue multiple missed periods automatically and does not keep
a direct bill-payment history link beyond the generated transaction note.

### Debt and money owed to the user

Users track money they owe or money owed to them, including balance, APR,
minimum/monthly payment, next due date, and linked account. Recording a payment:

- Reduces the tracked balance.
- Advances the due date by one month.
- Deactivates a fully paid record.
- Creates an expense for money owed or income for a receivable.

APR is displayed but not applied to the balance. The dashboard subtracts active
debts and adds active receivables when calculating net worth. Only minimum
payments on owed debts due by month end are reserved by planning calculations.

## Dashboard and planning

The dashboard combines all main records:

- Net worth from accounts plus receivables minus negative account balances and
  tracked debt.
- Current-month income, expenses, surplus, and savings rate.
- Safe-to-spend amount: non-credit positive balances minus bills due by month
  end, debt minimums due by month end, and the still-unmet savings allocation.
- Month-end forecast based on current daily income/expense pace and upcoming
  bill/debt reserves.
- Six-month income-versus-expense chart.
- Financial health score based on income, expense, liquid assets, essential
  spending, credit debt, and credit limit. With no current-month income it shows
  “Not enough data” instead of a numeric score.
- Custom Needs/Wants/Savings allocation percentages, which must total 100%.
- Current-month expense donut plus category names, amounts, and percentages.
- Up to four current planning alerts.

Calculations use the computer's local calendar. Forecasts are estimates, not
bank-grade projections, and do not inspect future income schedules.

## Currency behavior

TWD is the base storage currency. The user can display and enter either TWD or
USD. USD uses a fixed code-defined rate of `1 TWD = 0.03125 USD`; Plutus does not
download live exchange rates. Switching currency changes presentation and input
conversion, not the stored base amounts.

## Calculators

- **Compound interest simulator:** projects an initial principal plus monthly
  contributions using monthly compounding.
- **Loan/debt calculator:** estimates first-month payment, total interest, and
  total repayment using either equal-principal reducing balance or flat
  interest. Despite the screen title, it does not produce a month-by-month
  amortization table.

Calculator results are temporary and do not create financial records.

## Import, export, backup, and recovery

- **CSV export:** exports transactions with date, type, category, displayed
  amount/currency, account, and note. Cells starting with spreadsheet formula
  characters are prefixed to reduce formula-injection risk.
- **CSV import:** accepts income and expense rows with required Date, Type,
  Amount, and Account columns. Account IDs or names must match existing
  accounts. It updates balances and skips invalid rows. Transfers are not
  imported, and duplicate detection is not implemented.
- **Encrypted backup export:** downloads the current dataset as an AES-GCM JSON
  envelope encrypted for the current profile/PIN.
- **Encrypted restore:** decrypts a selected backup with the current profile key,
  validates its top-level shape, and replaces the current live dataset.
- **Automatic restore points:** every replacement of an existing disk vault
  copies its previous encrypted envelope into the profile's `backups` folder;
  the newest 50 are retained.
- **Legacy recovery:** when specifically provisioned recovery files match the
  active profile, the Tools screen can decrypt an earlier browser vault using
  its old PIN and migrate it into current storage.
- **Clear all:** replaces the current dataset with empty collections. It does
  not delete the profile and does not erase automatic historical backups.

## Desktop and keyboard behavior

The packaged Windows version runs in a 1280×800 pywebview window with a 900×600
minimum. The layout includes a mobile sidebar toggle. `N` opens a new transaction,
`H` toggles stealth mode, and `Escape` closes the modal/currency menu when focus
is not being used for the `N`/`H` shortcuts.
