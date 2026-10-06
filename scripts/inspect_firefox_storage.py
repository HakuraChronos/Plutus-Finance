"""Read-only inspector for a Firefox localStorage SQLite database."""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: inspect_firefox_storage.py <data.sqlite>")

    path = Path(sys.argv[1]).resolve()
    connection = sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True)
    tables = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    ).fetchall()
    print("tables:", ", ".join(row[0] for row in tables))

    for table_name, in tables:
        columns = [row[1] for row in connection.execute(f'PRAGMA table_info("{table_name}")')]
        print(f"{table_name} columns:", ", ".join(columns))
        if "key" not in columns or "value" not in columns:
            continue
        rows = connection.execute(f'SELECT key, value FROM "{table_name}"').fetchall()
        for key, value in rows:
            if not isinstance(key, str) or "plutus" not in key.lower():
                continue
            raw = value.decode("utf-8", errors="replace") if isinstance(value, bytes) else str(value)
            summary = f"key={key!r}, bytes={len(raw)}"
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, dict):
                    counts = []
                    for collection in ("wallets", "transactions", "budgets", "goals"):
                        item = parsed.get(collection)
                        if isinstance(item, list):
                            counts.append(f"{collection}={len(item)}")
                    if counts:
                        summary += ", " + ", ".join(counts)
            except json.JSONDecodeError:
                pass
            print(summary)


if __name__ == "__main__":
    main()
