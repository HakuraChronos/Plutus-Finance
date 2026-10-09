# Plutus data storage

Plutus stores profile metadata and encrypted financial data on the user's own
computer. It does not use a database or cloud synchronization.

## Storage locations

In source mode, data lives beside the `app/` directory. In the packaged build,
it lives beside `Plutus.exe`:

```text
User_data/
  users.json
  <profile-folder>/
    profile.json
    data.json
    backups/
      data-YYYYMMDD-HHMMSS-ffffff.json
```

The packaged desktop WebView also has a persistent `.desktop/` directory beside
the executable. Its localStorage contains a public profile-metadata cache and an
encrypted fallback copy of each vault. It is not the primary ledger store, but
it can be newer than disk after a failed server save.

`Recovery/` may contain explicitly prepared legacy migration files:

- `legacy-registry.json`
- `legacy-vault.json`

All of `User_data/*`, `.desktop/`, `.recovery/`, and `Recovery/` are ignored by
Git. Only `User_data/.gitkeep` is intended for source control.

## Files and confidentiality

### `User_data/users.json`

This is the private server registry. For each profile it stores:

- `username`
- `folder`
- base64 PBKDF2 `salt`
- base64 PBKDF2 `pinHash` verifier
- `iterations` (310,000 for new/current setup)
- `createdAt`

The profile list API removes `pinHash` before responding, but the registry file
itself is not encrypted. The salt and verifier are sensitive authentication
material and must not be logged or committed.

### `<profile>/profile.json`

This is a public-metadata copy containing username, folder, salt, iterations,
creation time, and whether PIN setup is still needed. It does not contain the
PIN verifier or financial records.

### `<profile>/data.json` and backups

These contain only an encrypted envelope shaped like:

```json
{
  "v": 1,
  "alg": "AES-GCM",
  "kdf": "PBKDF2-SHA256",
  "iterations": 310000,
  "iv": "<base64 12-byte random IV>",
  "cipher": "<base64 ciphertext and authentication tag>"
}
```

The browser derives a non-exportable 256-bit AES-GCM key from the PIN and
profile salt. The server does not decrypt this envelope and does not receive the
plain financial dataset.

### Browser/WebView localStorage

- `plutus_users_registry`: public profile metadata only; intentionally excludes
  the PIN verifier.
- `plutus_vault_<normalized-profile>`: `{ savedAt, vault }`, where `vault` is an
  encrypted envelope.
- `plutus_finance_v2`: a legacy key that is consumed and removed during an
  applicable migration.

The folder/storage-key normalization removes Windows-invalid characters,
changes whitespace to underscores, truncates to 64 characters, and lowercases
the localStorage suffix.

## Decrypted dataset schema

The following object exists in JavaScript memory only while unlocked. Money
values are numbers stored in base TWD.

### `settings`

| Field | Meaning |
|---|---|
| `currency` | Display/input currency: `TWD` or `USD`. |
| `stealthMode` | Whether privacy-sensitive amounts are visually hidden. |
| `theme` | `dark` or `light`; the current UI exposes no theme control. |
| `allocationTargets` | Numeric `needs`, `wants`, and `savings` percentages totaling 100. |
| `spendingAlertPercent` | Dashboard budget-alert threshold from 1 to 100. |

### `wallets`

| Field | Meaning |
|---|---|
| `id` | Account identifier. |
| `name` | User-visible account name. |
| `type` | `cash`, `bank`, `credit`, `ewallet`, or `savings`. |
| `balance` | Current balance, changed by transactions. |
| `initialBalance` | Starting balance; not used to recompute current balance. |
| `creditLimit` | Credit limit, normally zero for non-credit accounts. |
| `accountNumber` | Optional user-entered label/number. |
| `icon` | User-selected display icon. |

Interactive account deletion checks all account-ID references before changing
this collection. Any linked transaction, transfer, bill, debt, or receivable
blocks deletion; linked records are never automatically deleted or reassigned.

### `transactions`

| Field | Meaning |
|---|---|
| `id` | Transaction identifier. |
| `date` | Local `YYYY-MM-DD` date. |
| `type` | `income`, `expense`, or `transfer`. |
| `amount` | Positive base-currency amount. |
| `categoryId` | Fixed category ID; null for a transfer. |
| `walletId` | Source/affected account ID. |
| `toWalletId` | Destination account ID for a transfer, otherwise null. |
| `goalId` | Optional stable link used only by a goal-deposit expense. |
| `note` | User description. |
| `createdAt` | ISO timestamp recording creation time. |

### `budgets`

| Field | Meaning |
|---|---|
| `id` | Budget identifier. |
| `categoryId` | Expense category receiving the limit. |
| `limit` | Monthly base-currency limit. |
| `period` | Currently always `monthly`. |

### `goals`

| Field | Meaning |
|---|---|
| `id` | Goal identifier. |
| `title` | Goal name. |
| `targetAmount` | Desired base-currency amount. |
| `startingAmount` | Optional baseline for transaction-derived balances in new-format goals. |
| `currentAmount` | Stored compatibility cache, or the authoritative balance for a legacy goal. |
| `deadline` | Local `YYYY-MM-DD` target date. |
| `icon`, `color` | Display values. |

### `bills`

| Field | Meaning |
|---|---|
| `id`, `name` | Bill identifier and label. |
| `amount` | Recurring base-currency amount. |
| `nextDue` | Next local `YYYY-MM-DD` due date. |
| `frequency` | `monthly` or `yearly`. |
| `categoryId`, `walletId` | Generated expense category and payment account. |
| `active` | Whether planning should include the bill. |

### `debts`

| Field | Meaning |
|---|---|
| `id`, `name` | Debt/receivable identifier and label. |
| `kind` | `owed` or `receivable`. |
| `balance` | Remaining base-currency balance. |
| `interestRate` | Displayed APR percentage; currently not accrued. |
| `minimumPayment` | Amount reserved when an owed debt is due this month. |
| `nextDue` | Next local `YYYY-MM-DD` due date. |
| `walletId` | Account used for a generated payment transaction. |
| `active` | False after the balance reaches zero. |

## Read and save lifecycle

On unlock, the server returns the disk envelope and its filesystem modification
time. The client also reads its encrypted localStorage fallback. It tries the
newest candidate first, but falls back to the other if decryption fails. If the
browser copy is selected, it marks the session for server resynchronization.

Before use, `validateDataset()` requires `wallets`, `transactions`, `budgets`,
and `goals` arrays; limits each collection to 50,000 objects; limits serialized
data to roughly 1.5 MB; defaults missing `bills` and `debts` to empty arrays; and
normalizes settings. It does not currently validate every record field or the
relationships between records.

For a goal containing `startingAmount`, the live balance is reconciled as that
baseline plus positive, uniquely identified expense transactions whose
`goalId` matches the goal. Exact duplicate transaction IDs are counted once.
Legacy goals without `startingAmount` retain `currentAmount` exactly, and old
note-only transactions are not linked automatically. The optional fields do not
change the encrypted envelope or top-level dataset shape.

On save, the client clones a snapshot, encrypts it with a new IV, writes the
encrypted browser fallback, and sends the same envelope to the server. The
server accepts request bodies up to 2 MB. It copies the previous `data.json` to
`backups/`, keeps the newest 50 backups, writes a temporary JSON file, flushes it,
and atomically replaces the live file.

## Backup and restore behavior

- A downloaded `.json` backup is encrypted with the currently unlocked
  profile's key. Another profile/PIN cannot restore it.
- Restoring a downloaded backup replaces the whole live dataset after
  decryption and top-level validation. The old disk vault becomes an automatic
  encrypted backup.
- CSV export is plaintext and therefore more sensitive than the encrypted JSON
  backup. CSV includes transaction data and must be protected by the user.
- CSV import adds records to the current dataset and changes account balances;
  it does not replace existing records or detect duplicates.
- “Clear all” writes an empty current dataset. Previous encrypted automatic
  backups are retained, so this is not secure erasure.
- A forgotten PIN cannot be recovered from the application. Automatic backups
  also require the corresponding PIN-derived key.

## Storage risks and safeguards

Safeguards present in the code include loopback-only serving, blocked static
access to `User_data`, authenticated writes, same-origin checks for modifying
requests, AES-GCM integrity protection, request/data size limits, atomic file
replacement, encrypted backups, and Git ignores for local data.

Important limitations:

- The OS account can read profile names, salts, and PIN verifiers from
  `users.json`. Encryption mainly protects financial contents from casual file
  access; low-entropy numeric PINs can still be guessed offline.
- The verifier is accepted directly by the local API, so possession of it can
  authorize API access even without the original PIN. Decryption still needs the
  PIN-derived key.
- Logout does not revoke a server token; it expires after 30 minutes without an
  authorized request.
- Automatic backups multiply encrypted copies of old data. Deleting the live
  record does not delete its history.
- There is no file lock, schema version, or multi-file transaction. Concurrent
  requests and interrupted profile creation need stronger recovery handling.
- Invalid JSON is treated as missing by the server, which can hide corruption.

For these reasons, do not manually edit storage files. Before any repair, copy
the complete affected profile directory and registry to a trusted offline
location without exposing their contents in logs or source control.
