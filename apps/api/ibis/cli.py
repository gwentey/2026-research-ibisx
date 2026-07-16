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


if __name__ == "__main__":
    app()
