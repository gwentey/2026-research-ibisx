"""Registre central des modèles — garantit la résolution des FK inter-modules.

Tout point d'entrée qui ouvre une session (API, worker, CLI, alembic) doit avoir
chargé CE module : chaque nouveau module de modèles s'ajoute ici.
"""
