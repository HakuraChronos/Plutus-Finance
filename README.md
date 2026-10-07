# Plutus Finance

Plutus is a private, local-first personal finance application for managing
wallets, transactions, budgets, and savings goals. Financial records are
encrypted with your PIN and stored only on your computer.

## Financial planning features

- Recurring bills and subscriptions with upcoming due dates
- Safe-to-spend balance after reserved bills, debt payments, and savings
- Month-end cash-flow forecast based on current spending and income pace
- Debt, loan, and receivable tracking with linked repayment transactions
- Customizable needs, wants, and savings allocation targets
- Budget, upcoming-bill, and unusual-spending alerts
- Encrypted backups plus CSV transaction import and export

## Install on Windows

1. Open the [latest Plutus release](https://github.com/HakuraChronos/Plutus-Finance/releases/latest).
2. Download `Plutus-Windows.zip` from the **Assets** section.
3. Extract the ZIP file to a permanent location, such as
   `Documents\Plutus`. Do not run the application from inside the ZIP.
4. Keep all extracted files and folders together.
5. Double-click `Plutus.exe`.

Windows may display a SmartScreen warning because the application is not
digitally signed. Confirm that the ZIP came from this repository's official
Releases page before selecting **More info → Run anyway**.

The extracted package contains:

```text
Plutus.exe
README.md
Documentation/
User_data/
```

`User_data` contains your encrypted financial profiles. Do not delete it when
upgrading, and back it up periodically.

## First-time setup

1. Open `Plutus.exe`.
2. Select **Create another profile**.
3. Enter a profile name.
4. Create and confirm a PIN containing 6–12 digits.

Remember your PIN. Plutus cannot recover a forgotten PIN because it does not
store an unencrypted copy.

## Updating Plutus

1. Close Plutus completely.
2. Back up the existing `User_data` folder.
3. Download and extract the latest release.
4. Copy your existing `User_data` folder into the new Plutus folder.
5. Start the new `Plutus.exe`.

## Running from source

Requirements:

- Python 3.10 or newer
- A modern browser

Clone the repository and start the private local server:

```powershell
git clone https://github.com/HakuraChronos/Plutus-Finance.git
cd Plutus-Finance
python app/server.py
```

Then open <http://127.0.0.1:8765>. Keep the terminal open while using Plutus.
Do not open `app/index.html` directly, expose the server to the internet, or
change its address to `0.0.0.0`.

## Backups and privacy

Encrypted profiles are stored under `User_data/<profile-name>/`. Plutus also
keeps up to ten automatic encrypted restore points inside each profile's
`backups` folder.

Inside the application, open **Calculators & Data** to download or restore an
encrypted backup. A backup can only be restored while its matching profile is
unlocked with the correct PIN.

For the complete security model and limitations, read
[Security documentation](docs/SECURITY.md).

## Troubleshooting

- **Windows blocks the application:** Confirm it came from the official
  release page, then use **More info → Run anyway**.
- **The application does not open:** Extract the entire ZIP first and keep its
  folders together. Do not move only `Plutus.exe`.
- **The source version does not load:** Run `python app/server.py` and use the
  exact local address printed in the terminal.
- **The session expired:** Return to the login screen and unlock the profile
  again.
- **Too many sign-in attempts:** Wait five minutes before retrying.

More detailed usage information is available in
[the full documentation](docs/README.md).
