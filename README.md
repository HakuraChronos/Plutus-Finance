# Plutus Finance

Plutus is a private, local-first personal finance app for Windows. Track your
money, plan upcoming commitments, and keep financial records encrypted on your
computer.

## Current release

**v1.3.0** — [Download Plutus-Windows.zip](https://github.com/HakuraChronos/Plutus-Finance/releases/download/v1.3.0/Plutus-Windows.zip)

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

Requires Python 3.10 or newer and `requirements-build.txt`:

```powershell
git clone https://github.com/HakuraChronos/Plutus-Finance.git
cd Plutus-Finance
python -m pip install -r requirements-build.txt
python app/launcher.py
```

Or build the standalone `Plutus.exe` directly with `.\scripts\build-windows.ps1`.
See [Security](docs/SECURITY.md) for the security model and limitations.
