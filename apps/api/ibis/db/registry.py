"""Registre central des modèles — garantit la résolution des FK inter-modules.

Tout point d'entrée qui ouvre une session (API, worker, CLI, alembic) doit avoir
chargé CE module : chaque nouveau module de modèles s'ajoute ici.
"""

import ibis.modules.admin.models
import ibis.modules.auth.models
import ibis.modules.datasets.models
import ibis.modules.experiments.models
import ibis.modules.jobs.models
import ibis.modules.projects.models
import ibis.modules.xai.models  # noqa: F401
