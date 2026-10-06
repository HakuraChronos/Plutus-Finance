# Plutus security model

Plutus is a local-first finance application. Run the source version with
`python app/server.py` and
open only the printed `http://127.0.0.1:8765` address. Do not expose this server
to a public network or replace its loopback bind address with `0.0.0.0`.

## Protections

- `User_data` cannot be downloaded through the static web server.
- Vault payloads are encrypted in the browser with AES-256-GCM.
- PIN keys use PBKDF2-SHA256 with 310,000 iterations for new profiles.
- PIN verifiers are never returned by the profile-list endpoint or cached by
  the application.
- Vault reads require PIN verification. Writes require a short-lived random
  bearer token and same-origin requests.
- Sign-in attempts are limited to five per profile and client address in five
  minutes.
- Saves use atomic file replacement. The ten most recent encrypted versions
  are retained in `User_data/<profile>/backups`.
- Exported backups remain encrypted and can only be restored while the matching
  profile is unlocked with its PIN.

## Important limitations

- A forgotten PIN cannot be recovered. Keep an encrypted backup and remember
  the PIN that created it.
- Browser extensions or malware running as the same operating-system user may
  access data while a vault is unlocked.
- Lock the application before leaving the computer and keep the operating
  system account protected.
- `User_data` is ignored by Git. If it was committed before this rule existed,
  remove it from Git history and rotate exposed credentials.
