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


@app.command("create-admin")
def create_admin(
    email: str,
    password: str = typer.Option(
        None, prompt=True, hide_input=True, confirmation_prompt=True, help="Mot de passe (≥ 8)"
    ),
) -> None:
    """Crée (ou promeut) un compte administrateur (CDC §11)."""
    from ibis.modules.auth.bootstrap import create_admin as do_create

    user = do_create(email, password)
    typer.echo(f"Admin prêt : {user.email} (id={user.id})")


@app.command("import-kaggle")
def import_kaggle(
    config: str = typer.Option(None, help="Chemin du YAML (défaut : seed_data/datasets.yaml)"),
    only: list[str] = typer.Option(None, "--only", help="Limiter à certains slugs"),
    force: bool = typer.Option(False, help="Réimporter même si le slug existe déjà"),
) -> None:
    """Importe le catalogue de datasets (CDC §5.5.a) — idempotent, relançable.

    Les entrées `local_file` (embarquées) s'importent sans clé Kaggle ;
    les entrées `kaggle_ref` nécessitent KAGGLE_USERNAME/KAGGLE_KEY.
    """
    from pathlib import Path

    from ibis.db.engine import open_session
    from ibis.modules.datasets.importer import default_config_path, import_from_config

    path = Path(config) if config else default_config_path()
    db = open_session()
    try:
        report = import_from_config(db, path, only=list(only) if only else None, force=force)
    finally:
        db.close()
    typer.echo(f"Import terminé : {report.summary}")
    for slug in report.imported:
        typer.echo(f"  ✓ {slug}")
    for slug in report.skipped:
        typer.echo(f"  = {slug} (déjà présent)")
    for slug, error in report.failed:
        typer.echo(f"  ✗ {slug} : {error}")
    if report.failed:
        raise typer.Exit(code=1)


if __name__ == "__main__":
    app()
