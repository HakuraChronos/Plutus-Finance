# Plutus

Plutus is a private, local-first personal finance application for managing
wallets, transactions, budgets, and savings goals. Financial records are
encrypted with your PIN and stored only on your computer.

## Easiest option for Windows users

The Windows version does not require Python, a terminal, or an installation.

1. Open the repository's **Releases** page on GitHub.
2. Open the latest release and download `Plutus-Windows.zip`.
3. Extract the ZIP file to a location such as `Documents\Plutus`.
4. Open the extracted folder and double-click `Plutus.exe`.
5. Plutus opens in its own desktop window. No web browser is needed.

To finish, sign out and close the Plutus window. The private local service
stops automatically.

Windows may display a SmartScreen warning because independently distributed
applications are not digitally signed. Confirm that the file came from this
repository's official Releases page before selecting **More info → Run anyway**.

The extracted package has a deliberately simple layout:

```text
Plutus.exe
Documentation/
User_data/
```

Keep these items together. Plutus stores encrypted profiles inside `User_data`.

## Running from source

The following instructions are for developers or platforms without a packaged
release.

### Requirements

- Python 3.10 or newer
- A modern browser such as Chrome, Edge, Firefox, or Safari (source mode only)

No Python packages or JavaScript dependencies need to be installed.

### Downloading the source

Download the project from GitHub using either method:

1. Select **Code → Download ZIP**, then extract the ZIP file.
2. Or clone the repository:

   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

### Opening from source

Plutus must be started through its private local server. Do not open
`index.html` directly.

### Windows

1. Open the extracted Plutus folder in File Explorer.
2. Click the address bar, type `powershell`, and press Enter.
3. Start Plutus:

   ```powershell
   python app/server.py
   ```

   If `python` is not recognized, try:

   ```powershell
   py app/server.py
   ```

### macOS or Linux

Open a terminal in the Plutus folder and run:

```bash
python3 app/server.py
```

### Open Plutus

When the terminal displays:

```text
Plutus running securely at http://127.0.0.1:8765
```

open this address in your browser:

<http://127.0.0.1:8765>

Keep the terminal window open while using Plutus. Closing it stops the local
server.

## First-time setup

1. Select **Create another profile**.
2. Enter a profile name.
3. Create a PIN containing 6–12 digits.
4. Confirm the PIN and select **Create vault**.

Remember your PIN. Plutus cannot recover a forgotten PIN because it does not
store an unencrypted copy of it.

## Closing Plutus safely

1. Select **Sign out** inside the application.
2. Wait for the locked login screen to appear.
3. Close the Plutus desktop window. When running from source, also stop the
   terminal server with `Ctrl+C` and close the browser tab.

## Backups

Open **Calculators & Data** inside Plutus to download an encrypted backup or
restore one. A backup can only be restored while the matching profile is
unlocked with its PIN.

Plutus also keeps up to ten automatic encrypted restore points inside:

```text
User_data/<profile-name>/backups/
```

Copy encrypted backups to another trusted drive periodically. Do not rename,
edit, or manually combine vault files.

## Where data is stored

Profiles and encrypted financial records are saved under:

```text
User_data/<profile-name>/
```

The local server blocks browsers from directly downloading this folder.
`User_data` is also excluded from Git so personal records are not uploaded with
the source code.

Do not expose the server to the internet or change its address from
`127.0.0.1` to `0.0.0.0`.

For details about encryption, sessions, backups, and security limitations, see
[SECURITY.md](SECURITY.md).

## Troubleshooting

### Python is not installed

Install Python 3.10 or newer from <https://www.python.org/downloads/>. On
Windows, enable **Add Python to PATH** during installation, then reopen the
terminal.

Confirm the installation with:

```bash
python --version
```

On macOS or Linux, use `python3 --version` instead.

### The page does not open

- Confirm the terminal is still running `app/server.py`.
- Use exactly `http://127.0.0.1:8765`.
- Do not double-click `index.html`.
- If port 8765 is already occupied, close the other Plutus server and try
  again.

### The secure local server is unavailable

This message usually means Plutus was opened directly or the terminal was
closed. Start `app/server.py`, reload the browser page, and try again.

### The session expired

For security, inactive vault sessions expire. Return to the login screen and
unlock the profile again with its PIN.

### Too many sign-in attempts

After five incorrect attempts, Plutus pauses further attempts for five
minutes. Wait five minutes and retry carefully.

## Privacy reminder

Plutus protects data stored by the application, but an unlocked vault can
still be observed by malware, browser extensions, or someone using the same
computer. Keep the operating system updated, use a protected computer account,
install only trusted extensions, and lock Plutus when stepping away.
