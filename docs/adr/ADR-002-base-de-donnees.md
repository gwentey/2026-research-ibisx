# ADR-002 — Base de données

- **Statut** : accepté (2026-07-16)
- **Source** : [docs/refonte/02-ARCHITECTURE.md](../refonte/02-ARCHITECTURE.md) §6

## Décision

**PostgreSQL 16 unique** : une base, un schéma, **une seule chaîne de migrations Alembic** exécutée au démarrage de l'API (`alembic upgrade head` sous verrou advisory).

PostgreSQL est nécessaire (pas seulement confortable) :
- colonnes `ARRAY` (`domain`, `task`) + index **GIN** pour les filtres de containment ;
- `JSONB` (métriques, configs, stats de colonnes, critères de projets) ;
- transactions multi-tables, `pg_trgm` pour la recherche.

SQLite ne tient pas (ARRAY/JSONB/concurrence worker) ; MySQL n'apporte rien ici.

## Conséquences

- [NE PAS REPRODUIRE] les 4 chaînes Alembic parallèles et la double `Base` SQLAlchemy de la v1.
- Toute valeur JSONB passe par un **sanitizer unique** (jamais de NaN/Inf).
- Le schéma complet (users, datasets, projects, experiments, explanations, jobs…) est défini dans ARCH §6.2 et créé progressivement jalon par jalon.
