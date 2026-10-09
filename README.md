# Plutus Finance

Plutus is a private, local-first personal finance app for Windows. Track your
money, plan upcoming commitments, and keep financial records encrypted on your
computer.

## Current release

**v1.2.5** — [Download Plutus-Windows.zip](https://github.com/HakuraChronos/Plutus-Finance/releases/download/v1.2.5/Plutus-Windows.zip)

1. Download and extract the ZIP.
2. Keep all extracted files together.
3. Open `Plutus.exe` and sign in with your username and PIN.

## Features

- Encrypted local profiles with a private animated login
- Accounts, transactions, budgets, and savings goals
- Bills, subscriptions, debts, loans, and receivables
- Safe-to-spend balance and month-end cash-flow forecast
- Custom allocation targets and spending alerts
- Encrypted backups plus CSV import and export

Your records stay inside `User_data` and are never uploaded by Plutus. Keep
that folder when updating, and remember your PIN—it cannot be recovered.

## Run from source

Requires Python 3.10 or newer:

```powershell
git clone https://github.com/HakuraChronos/Plutus-Finance.git
cd Plutus-Finance
python app/server.py
```

Open <http://127.0.0.1:8765>. See [Security](docs/SECURITY.md) for the security
model and limitations.
