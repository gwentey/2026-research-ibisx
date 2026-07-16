"""Exporte le schéma OpenAPI vers un fichier JSON (source du client TS généré, ADR-007).

Usage : python -m ibis.export_openapi <chemin/openapi.json>
La CI compare cet export au fichier commité : toute dérive du contrat casse le build.
"""

import json
import sys
from pathlib import Path

from ibis.main import app


def export(target: str) -> None:
    schema = app.openapi()
    path = Path(target)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(schema, indent=2, sort_keys=True, ensure_ascii=False) + "\n")
    print(f"OpenAPI exporté → {path} ({len(schema.get('paths', {}))} chemins)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        raise SystemExit(1)
    export(sys.argv[1])
