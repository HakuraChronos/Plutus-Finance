# Plutus contributor guide

This file applies to the whole repository. It is written for future coding
agents and maintainers.

## Project in one paragraph

Plutus is a local-first personal finance desktop application. The interface is
plain HTML, CSS, and browser JavaScript modules. A small Python HTTP server
serves those files and writes encrypted vault envelopes to disk. The packaged
Windows application starts that server inside a `pywebview` window. There is no
database, front-end framework, npm package, or remote application service.

## Repository map

- `app/index.html`: application shell and navigation.
- `app/js/main.js`: loads the application controller and login gate.
- `app/js/login.js`: animated login, profile creation, unlock, and PIN setup.
- `app/js/auth.js`: browser cryptography, API client, session state, and local
  encrypted fallback.
- `app/js/state.js`: in-memory data model, business mutations, imports, exports,
  and queued persistence.
- `app/js/models.js`: fixed categories, account types, and financial health
  calculation.
- `app/js/utils/`: local-calendar, CSV, planning, and HTML-escaping helpers.
- `app/js/views/`: dashboard and feature screens.
- `app/js/components/`: modals, toasts, and canvas charts.
- `app/server.py`: loopback HTTP server, profile registry, sessions, vault I/O,
  backups, and legacy recovery API.
- `app/launcher.py`: Windows desktop lifecycle and embedded WebView2 window.
- `app/css/`: global variables, layout, components, views, and login animation.
- `tests/`: one Python server test and Node-based JavaScript tests.
- `scripts/build-windows.ps1`: PyInstaller build and ZIP packaging.
- `scripts/inspect_*_storage.py`: specialist, mostly read-only recovery tools.
- `.github/workflows/build-windows.yml`: tagged/manual Windows test and release
  workflow.

Architecture details are in `docs/ARCHITECTURE.md`. Feature behavior is in
`docs/FEATURES.md`, and the storage contract is in `docs/DATA_STORAGE.md`.

## Non-negotiable data-safety rules

- Never read, edit, delete, copy, print, test against, or commit real files in
  `User_data/`, `.desktop/`, `.recovery/`, or `Recovery/` unless the owner gives
  explicit, narrow permission.
- Use temporary directories and synthetic records for persistence tests. The
  existing Python test replaces the server module's data paths with a temporary
  folder; preserve that pattern.
- Do not put financial contents, PINs, PIN verifiers, salts, vault keys, session
  tokens, or recovery artifacts in logs, fixtures, screenshots, or commits.
- Do not weaken loopback binding, the static `User_data` block, origin checks,
  security headers, encryption, atomic writes, or `.gitignore` protections.
- Treat changes to `auth.js`, `server.py`, vault validation, import/restore,
  balance updates, and date calculations as high-risk changes.
- Do not change the stored schema without a backward-compatible migration and
  migration tests. Old encrypted vaults must remain readable.

## Important invariants

- All stored money values are in base TWD. USD is a display/input conversion
  using the fixed rate in `state.js`; changing the display currency must not
  rewrite stored amounts.
- Dates use local calendar keys in `YYYY-MM-DD` format. Use helpers from
  `app/js/utils/dates.js`; do not derive date keys with UTC ISO slicing.
- A transaction mutation and its account-balance mutation must stay consistent.
  Deleting a transaction reverses the same balance effects.
- Bill payments, debt/receivable payments, and goal deposits create ordinary
  transactions, which then feed budgets, dashboard totals, and forecasts.
- New-format goal balances derive from `startingAmount` plus unique expense
  transactions carrying the matching `goalId`. Keep `currentAmount` synchronized
  as a compatibility cache, and never infer legacy links from transaction notes.
- Browser code encrypts/decrypts financial records. The Python server stores an
  opaque AES-GCM envelope and must not receive plaintext ledger data.
- Saves are queued in `StateStore.persistChain`; do not introduce unordered
  writes that could let an older snapshot overwrite a newer one.
- User-controlled values placed in HTML templates must pass through
  `escapeHtml`. Prefer `textContent` where possible.

## Development commands

Run from the repository root.

```powershell
# Source server (standard-library Python only)
python app/server.py

# Python tests
python -m unittest discover -s tests -p "test_*.py" -v

# JavaScript tests (Node must support Web Crypto and ES modules)
$jsTests = Get-ChildItem tests\test_*.mjs | Select-Object -ExpandProperty FullName
node --test $jsTests

# Windows package; requires requirements-build.txt dependencies
.\scripts\build-windows.ps1
```

Do not install dependencies unless the owner asks. `requirements-build.txt`
contains packaging/runtime dependencies for the desktop executable, not the
source-mode HTTP server.

## Change checklist

1. Read the relevant view, `state.js`, and any helper it calls before editing.
2. Trace whether the change affects balances, dates, currency conversion,
   encryption, persistence, backups, or legacy data.
3. Add focused tests. Prefer pure helper tests for calculations and temporary
   directories for server behavior.
4. Run both Python and JavaScript suites locally before committing or pushing.
5. For desktop or release changes, also run the Windows build and smoke-test the
   extracted package before creating a tag.
6. Confirm `git status` contains no personal-data paths or generated binaries.
7. Update the relevant documentation when behavior or the storage contract
   changes.

## Known areas requiring extra care

- Dataset validation currently checks collection shape and size, but not every
  record field or cross-record reference.
- Account deletion must remain blocked while transactions, transfers, bills, or
  debts/receivables reference it. Never replace this guard with cascading delete
  or automatic reassignment.
- The threaded server has atomic individual-file writes but no lock or
  multi-file transaction around registry/profile/vault changes.
- Client logout discards the token locally but has no server-side revocation
  endpoint; tokens expire after 30 minutes of inactivity.
- The UI is assembled with large HTML template strings and full-view rerenders,
  so escaping and event rebinding need careful review.
- Existing JavaScript tests mostly exercise pure logic. They are not browser
  end-to-end tests.
