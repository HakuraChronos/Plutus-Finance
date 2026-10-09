# Plutus architecture

This document was first audited at commit `1d834d2` on 2026-10-10 and is updated
as implementation phases are completed. The release name `v1.2.5` comes from
the README and Git tag; there is no separate version constant in the application.

## Technology and dependencies

Plutus does not use a front-end framework. It is a small single-page application
built with HTML, CSS, ES modules, the Web Crypto API, Canvas 2D, `fetch`, and
browser `localStorage`.

The source-mode server uses only the Python standard library. The packaged
desktop app adds:

- `pywebview >= 5, < 7` for the native window and Edge WebView2 host.
- `PyInstaller >= 6, < 7` to create `Plutus.exe`.

There is no SQL database, cloud backend, analytics SDK, npm dependency, or
automatic network synchronization in the source reviewed.

## Runtime shape

```text
User
  |
  v
HTML/CSS views + JavaScript state
  |  Web Crypto: decrypt/encrypt in memory
  |  fetch to same-origin /api/*
  v
Python ThreadingHTTPServer on 127.0.0.1:8765
  |  opaque encrypted JSON + profile metadata
  v
User_data/ beside the source tree or Plutus.exe
```

In source mode, `python app/server.py` serves `app/` and the user opens the
loopback URL in a browser. In the Windows build, `launcher.py` starts the same
server on a daemon thread, opens the URL inside pywebview, stores WebView data in
`.desktop/`, and stops the server when the window closes.

The server uses a fixed port. There is no port-selection fallback or
single-instance coordinator, so another process already using port 8765 can
prevent startup.

## Client layers

### Login and authentication

`login.js` owns the locked screen, the one-time logo animation, profile creation,
legacy PIN setup, unlock, and handoff to the main application. It asks `auth.js`
to communicate with the local API and perform cryptography.

`auth.js` derives two equivalent PBKDF2-SHA256 results from the PIN and per-user
salt: a base64 verifier sent to the server and a non-exportable AES-GCM key kept
in browser memory. New profiles use 310,000 iterations. Financial JSON is
encrypted and decrypted only in the browser.

### State and business rules

`state.js` owns one `StateStore` singleton. After unlock, it validates the
decrypted dataset, holds it in memory, and notifies subscribers. Business actions
mutate the store and call `save()`. Saves clone the state and run in order through
a promise chain, which prevents older client snapshots from overtaking later
ones in the same window.

The store also owns currency conversion, account-balance effects, recurring
payments, debts, goals, backup/restore, and CSV import/export. `models.js`
provides fixed categories and the health-score formula. `utils/planning.js`
derives monthly activity, commitment reserves, forecasts, and alerts.

New savings goals use a transaction-derived balance. `startingAmount` is the
baseline and unique expense transactions with a matching `goalId` are the
contributions. `currentAmount` is retained and synchronized as a compatibility
cache. Legacy goals without the new baseline continue to use their stored
`currentAmount`; old note text is never guessed as a relationship.

Account deletion is guarded in the store: regular transactions, both sides of a
transfer, bills, and debts/receivables are checked before the account is removed.
The UI performs the same check to explain the affected record types, while the
store rechecks it as the authoritative protection.

### Rendering

`app.js` controls navigation, shared toolbar behavior, privacy mode, save status,
and the current view. Each file in `app/js/views/` replaces the main container's
HTML and attaches its own event listeners. `modal.js` similarly builds modal
forms from template strings. Charts use Canvas 2D directly.

Transaction search text is contextually escaped before it is restored into the
search input's HTML attribute. Transaction types are escaped before entering a
CSS class attribute as defense in depth for malformed restored datasets.

This approach keeps the dependency count small, but rendering, business actions,
and DOM event wiring are tightly coupled. Full rerenders also make browser-level
tests and fine-grained updates harder.

## Server layers

`server.py` combines four responsibilities:

1. Static delivery of the application files.
2. Profile registry and login-verifier checks.
3. In-memory bearer sessions and rate limiting.
4. Encrypted vault persistence, backup rotation, and legacy recovery delivery.

The server binds only to `127.0.0.1`. It blocks direct static access to
`User_data`, dot-prefixed paths, and unknown API paths. It sets CSP, no-cache,
anti-framing, MIME-sniffing, referrer, and same-origin resource headers.

Bearer tokens are random, memory-only, and have a sliding 30-minute inactivity
expiry. Login failures are limited to five attempts per client IP in five
minutes. Because every local browser request has the loopback address, that is
effectively one shared limiter for the running server, not a per-profile limit.

Individual JSON writes use a temporary file, flush, `fsync`, and atomic replace.
Before an existing vault is replaced, the server copies it to the profile's
backup directory and keeps the newest 50 copies.

## Main data flow

### Unlock

1. The client reads public profile metadata from `GET /api/profiles`.
2. The user supplies username and PIN.
3. The browser derives the verifier and sends it to `POST /api/session`.
4. The server compares it with `User_data/users.json` and returns a token plus
   the encrypted vault.
5. The browser derives the AES key, chooses the newest usable disk/browser
   encrypted copy, decrypts it, validates the dataset, and attaches it to the
   store.

### Save

1. A store mutation updates the in-memory dataset.
2. `save()` deep-clones the snapshot and queues it.
3. `auth.writeVault()` encrypts it with a new random 12-byte AES-GCM IV.
4. The encrypted envelope is written to localStorage first.
5. `PUT /api/vault` writes it to disk after same-origin and bearer-token checks.
6. The server backs up the previous encrypted disk envelope and atomically
   replaces `data.json`.

If the disk write fails, the encrypted browser copy is retained and selected on
a later unlock when its timestamp is newer. The next attached session attempts
to resynchronize it to disk.

## Build and release

`scripts/build-windows.ps1` bundles the server, HTML, CSS, and JavaScript into a
one-file, windowed executable. It creates `dist/Plutus-Windows.zip` containing:

```text
Plutus.exe
README.md
Documentation/SECURITY.md
User_data/README.txt
```

The GitHub workflow runs on version tags or manual dispatch. It uses Python
3.12, installs `requirements-build.txt`, runs the Python and Node tests, builds
the ZIP, uploads it as an artifact, and publishes tag builds as releases.

## Current automated coverage

- Python: profile creation, public-profile filtering, authenticated saves,
  backup creation, restart/login persistence, static private-path blocking, and
  temporary-file cleanup.
- JavaScript: local/disk fallback selection, local calendar and DST behavior,
  login source/privacy structure, planning formulas, commitments, CSV parsing,
  legacy defaults, some balance effects, account-deletion referential integrity,
  transaction HTML-injection prevention, and goal-deposit consistency and
  reconciliation.

These tests passed during the 2026-10-10 audit.

## Technical debt and risks found

### High priority

- **Imported record integrity is not fully enforced.** Interactive account
  deletion is blocked when transactions, transfers, bills, or debts reference
  the account. However, restored datasets receive only shallow validation and
  can still contain dangling references created outside the normal UI.
- **Restored data is only shallowly validated.** Collections must be arrays of
  objects, but required fields, types, finite money values, valid dates, unique
  IDs, allowed categories, and cross-record references are not checked. A
  malformed but decryptable backup can cause wrong totals or rendering errors.
- **PIN verifier design has avoidable risk.** The PBKDF2 output stored in
  `users.json` is accepted directly by the local session API. A process that can
  read that verifier can authenticate to the API without knowing the PIN. It
  still cannot decrypt the vault without the PIN-derived AES key, but it could
  obtain a write token and replace encrypted data. Numeric PINs also permit
  offline guessing if an attacker copies the registry and vault.
- **Multi-file and concurrent writes are not coordinated.** The threaded server
  uses atomic writes per file but no lock or transaction across `users.json`,
  `profile.json`, and `data.json`. A crash between profile steps or concurrent
  requests can leave partial state or lose an update.

### Medium priority

- Client sign-out drops its token but does not revoke it on the server. It stays
  usable until its sliding inactivity deadline.
- `read_json()` treats missing, unreadable, and invalid JSON alike. Registry
  corruption can appear to be an empty registry, and vault corruption can appear
  to be a missing vault instead of producing a clear recovery error.
- “Clear All Records” saves an empty live vault, but older encrypted data remains
  in up to 50 automatic backups. The UI's “permanently clear” wording is
  therefore inaccurate.
- IDs for accounts, budgets, and goals rely only on `Date.now()`. Two creations
  in one millisecond can collide. Other record types add a short random suffix.
- Currency conversion uses a hard-coded USD rate of 0.03125 per TWD. It is a
  display convention, not a current exchange-rate service.
- The month-end forecast extrapolates all current expenses and also subtracts
  all bills/debt due by month end. If a due item has already influenced the
  spending pace but has not been marked paid, the estimate can effectively
  count that pressure twice.
- Debt APR is stored and displayed but never accrues into the tracked balance.
- `docs/README.md` and `docs/SECURITY.md` say ten backups; the server keeps 50.
  The security guide also describes rate limiting as per-profile and client,
  while the implementation keys only on client address.

### Maintainability

- `state.js`, `modal.js`, and the view files combine validation, calculations,
  mutation, HTML, and events. Splitting pure domain operations from UI code
  would make correctness easier to test.
- There is no explicit dataset schema version or general migration pipeline.
  Optional `bills` and `debts` are the only current compatibility defaults.
- Error reporting at sign-in deliberately turns every unlock error into
  “Incorrect username or PIN,” which also hides server unavailability and rate
  limiting from the user.
- Recovery scripts are specialized tools. The Chromium scanner imports helpers
  expected under ignored `.recovery/` paths, so it is not runnable from a clean
  checkout without separately provisioned code.

## Automated tests most needed

1. Browser end-to-end tests for create, unlock, wrong PIN, rate limit, logout,
   session expiry, save failure, restart, and recovery animation/accessibility.
2. Property/invariant tests for every transaction type and for delete/reversal,
   including missing accounts, same-account transfers, and account deletion.
3. Strict schema and hostile-import tests covering NaN-like values, wrong field
   types, invalid dates, duplicate IDs, dangling references, oversized files,
   damaged ciphertext, and backups belonging to another profile.
4. Server security tests for Origin handling, missing/expired/revoked tokens,
   body limits, path traversal and encoded paths, backup pruning at 50, registry
   corruption, concurrent creates/saves, and partial-write recovery.
5. Calculation tests for financial health boundaries, allocation validation,
   safe-to-spend, forecast edge cases, unusual-spend baselines, debt/receivable
   net worth, credit-account sign conventions, and both calculator methods.
6. DOM/render tests for escaping every user-controlled field, transaction
   filters, modal validation, privacy mode, charts, keyboard controls,
   responsive navigation, and reduced-motion behavior.
7. Release smoke tests that start the built executable, create a synthetic
   profile, save/reopen it, verify packaged documentation, and close cleanly.

## Uncertainties

- The code does not define whether a credit-card starting balance should be
  entered as positive available funds or negative debt. Calculations assume
  negative balances are debt, while the account form and card label do not state
  the sign convention.
- No product specification explains whether debt interest is intentionally
  informational or should change balances.
- The tests do not launch a real browser or the packaged executable, so this
  audit cannot prove visual, WebView2, accessibility, or packaging behavior from
  the automated suite alone.
