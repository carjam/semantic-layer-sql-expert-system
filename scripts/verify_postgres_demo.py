"""
Verify sql/postgres/demo.sql parses as valid PostgreSQL (no database required).

Usage:
  pip install pglast
  python scripts/verify_postgres_demo.py

For a full execution test, run against a live server (see README Quick start)
or start Docker Desktop and use a postgres:16 container.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL_PATH = ROOT / "sql" / "postgres" / "demo.sql"


def main() -> None:
    try:
        import pglast
    except ImportError as e:
        raise SystemExit(
            "Install pglast: pip install pglast\n"
            "Then re-run this script."
        ) from e

    sql = SQL_PATH.read_text(encoding="utf-8")
    trees = pglast.parser.parse_sql(sql)
    print(f"OK: {SQL_PATH.relative_to(ROOT)} parses as {len(trees)} PostgreSQL statement(s).")


if __name__ == "__main__":
    main()
