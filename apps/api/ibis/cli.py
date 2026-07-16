"""CLI d'administration `ibis` (CDC §11, ARCH §4).

Commandes ajoutées au fil des jalons :
- J1 : create-admin
- J2 : import-kaggle
- J9 : seed
"""

import typer

app = typer.Typer(name="ibis", help="CLI d'administration IBIS-X v2", no_args_is_help=True)


@app.command()
def version() -> None:
    """Affiche la version du backend."""
    from ibis import __version__

    typer.echo(f"ibis-api {__version__}")


if __name__ == "__main__":
    app()
