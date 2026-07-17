"""Registre central des modèles — garantit la résolution des FK inter-modules.

Tout point d'entrée qui ouvre une session (API, worker, CLI, alembic) doit avoir
chargé CE module : chaque nouveau module de modèles s'ajoute ici.
"""

import ibis.modules.admin.models  # noqa: F401
import ibis.modules.auth.models  # noqa: F401
import ibis.modules.datasets.models  # noqa: F401
import ibis.modules.experiments.models  # noqa: F401
import ibis.modules.jobs.models  # noqa: F401
import ibis.modules.projects.models  # noqa: F401
import ibis.modules.xai.models  # noqa: F401
