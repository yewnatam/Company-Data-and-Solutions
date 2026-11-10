"""Build the CDS website or export its SQL comparisons."""

import argparse
import csv
import sqlite3
import sys
from pathlib import Path

from .build import build
from .ingest import normalize

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description="CDS annual reporting snapshot")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("build")
    report = commands.add_parser("report")
    report.add_argument("--company")
    arguments = parser.parse_args()
    try:
        path = build(ROOT)
        if arguments.command == "build":
            print(f"Built {path.relative_to(ROOT)}")
            return 0
        with sqlite3.connect(ROOT / ".build/companies.sqlite3") as db:
            db.row_factory = sqlite3.Row
            cik = None
            if arguments.company:
                row = db.execute("SELECT cik FROM aliases WHERE alias = ?", (normalize(arguments.company),)).fetchone()
                if row is None:
                    parser.error("Company is not in this supported snapshot")
                cik = row[0]
            rows = db.execute("SELECT * FROM comparisons WHERE (? IS NULL OR cik = ?) ORDER BY cik, metric", (cik, cik)).fetchall()
            writer = csv.DictWriter(sys.stdout, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(dict(row) for row in rows)
        return 0
    except (OSError, ValueError, sqlite3.Error) as error:
        print(f"CDS: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
