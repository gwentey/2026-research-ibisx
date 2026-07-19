# Évolution 1 XAI — Nombres lisibles : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** le LLM, les replis déterministes et les graphiques citent des importances en % entiers avec des noms de variables humanisés (« Sex = female : 24 % »), plus jamais `cat__Sex_female = 0.242421`.

**Architecture :** tout passe par `build_context()` (partagé explication + chat) dans `xai_text.py` — on y ajoute `humanize_feature()` + formatage % (dénominateur = Σ|v| de la liste reçue = top-15 affiché par les charts). Le garde-fou gagne la seule tolérance symétrique ÷100. Le front reçoit un miroir minimal (`lib/xai/features.ts`) branché sur les charts et `featureImpact`.

**Tech Stack :** FastAPI/Python 3.12 (uv, pytest, ruff, mypy) · Next.js 16/TS (pnpm, vitest).

**Design validé :** `docs/superpowers/specs/2026-07-19-xai-evo1-nombres-lisibles-design.md`.

## Global Constraints

- CDC `docs/specs/xai-evolutions/cdc.md` §Évolution 1 fait foi ; acquis prod intouchables : chemin `reasoning` de `client.py`, replis `is_fallback`, log `xai_text.foreign_numbers`.
- **Un lot = un commit** (règle CDC §Ordre) : commit unique en fin d'évolution, en français, **sans attribution Claude**.
- Pas de route/schéma/migration/OpenAPI dans cette évolution.
- i18n : toute chaîne visible dans `apps/web/messages/fr.json` **et** `en.json`.
- Arrondi % : demi-parts vers le haut (`int(pct + 0.5)` côté Python, `Math.round` côté TS — parité exacte, pas de banker's rounding).
- Vérifs avant commit — API : `cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run mypy ibis && uv run pytest -q` · Web : `cd apps/web && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

---

### Task 1 : Backend — helpers `humanize_feature` + `format_share` + `_round3`

**Files:**
- Modify: `apps/api/ibis/modules/llm/xai_text.py`
- Test: `apps/api/tests/unit/test_xai_text.py`

**Interfaces:**
- Produces: `humanize_feature(name: str) -> str`, `format_share(value: float, total: float) -> str` (publiques — réutilisées par `blocks.py` en Task 4 et par l'Évolution 4), `_round3(value: Any) -> str` (interne module).

- [ ] **Step 1 : tests rouges** — ajouter à `test_xai_text.py` :

```python
def test_humanize_feature_onehot() -> None:
    assert xai_text.humanize_feature("cat__Sex_female") == "Sex = female"
    assert xai_text.humanize_feature("cat__Embarked_S") == "Embarked = S"
    # Colonne snake_case : coupure au DERNIER « _ » (design D1).
    assert xai_text.humanize_feature("cat__niveau_etude_Bac") == "niveau etude = Bac"


def test_humanize_feature_numeric_ordinal_and_plain() -> None:
    assert xai_text.humanize_feature("num_median_0__Pclass") == "Pclass"
    assert xai_text.humanize_feature("num_mean_2__fare_amount") == "fare amount"
    assert xai_text.humanize_feature("cat__Sex") == "Sex"  # ordinal, pas de catégorie
    assert xai_text.humanize_feature("age") == "age"  # déjà lisible


def test_format_share_rounds_half_up_and_floors_dust() -> None:
    assert xai_text.format_share(0.242421, 1.0) == "24 %"
    assert xai_text.format_share(0.125, 1.0) == "13 %"  # demi-part vers le haut (12.5)
    assert xai_text.format_share(0.003, 1.0) == "<1 %"
    assert xai_text.format_share(-0.24, 1.0) == "24 %"  # magnitude
    assert xai_text.format_share(0.5, 0.0) == "0 %"  # total nul, jamais d'exception
```

- [ ] **Step 2 : vérifier l'échec** — `cd apps/api && uv run pytest tests/unit/test_xai_text.py -q` → FAIL (`AttributeError: humanize_feature`).

- [ ] **Step 3 : implémentation** dans `xai_text.py` (après `SYSTEM`, avant `build_context`) :

```python
def humanize_feature(name: str) -> str:
    """Nom technique du pipeline → libellé lisible (CDC évolutions §1).

    `cat__Sex_female` → « Sex = female », `num_median_0__Pclass` → « Pclass »,
    `cat__Sex` (ordinal) → « Sex », nom sans préfixe → inchangé. Les colonnes
    snake_case gardent leur sens : coupure au DERNIER « _ » (les catégories
    multi-underscore sont plus rares que les colonnes multi-mots).
    """
    transformer, sep, rest = name.partition("__")
    if not sep or not rest:
        return name
    if transformer == "cat" and "_" in rest:
        column, _, category = rest.rpartition("_")
        return f"{column.replace('_', ' ')} = {category}"
    return rest.replace("_", " ")


def format_share(value: float, total: float) -> str:
    """Part entière de |value| dans total : « 24 % », « <1 % » sous 0.5 %.

    Demi-parts vers le haut (parité exacte avec Math.round côté front).
    """
    if total <= 0:
        return "0 %"
    pct = abs(value) / total * 100
    return "<1 %" if pct < 0.5 else f"{int(pct + 0.5)} %"


def _round3(value: Any) -> str:
    """Format lisible 3 décimales max, robuste aux valeurs non numériques."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return str(value)
    return f"{round(float(value), 3):g}"
```

- [ ] **Step 4 : vérifier le vert** — `uv run pytest tests/unit/test_xai_text.py -q` → PASS.

---

### Task 2 : Backend — `build_context` en % humanisés + consigne prompts

**Files:**
- Modify: `apps/api/ibis/modules/llm/xai_text.py` (`build_context`, `build_prompt`, `chat_prompt_v2`)
- Test: `apps/api/tests/unit/test_xai_text.py`

**Interfaces:**
- Consumes: `humanize_feature`, `format_share`, `_round3` (Task 1).
- Produces: contexte au format « `Sex = female : 24 %` » (liste reçue entière, Σ ≈ 100), métriques/valeurs locales à 3 déc., flèches ↗/↘ pour contributions signées ; signature de `build_context` inchangée.

- [ ] **Step 1 : tests rouges** (ajouter `import re` en tête de `test_xai_text.py`) :

```python
TITANIC_IMPORTANCE = [
    {"feature": "cat__Sex_female", "value": 0.242421},
    {"feature": "num_median_0__Pclass", "value": 0.5},
    {"feature": "num_median_0__Fare", "value": 0.257579},
]


def _titanic_context() -> str:
    return xai_text.build_context(
        metrics={"primary_metric": "accuracy", "accuracy": 0.8324451, "f1": 0.77},
        importance=TITANIC_IMPORTANCE,
        task_type="classification",
        algorithm="random_forest",
        explanation_type="global",
        local_values=None,
    )


def test_build_context_shows_percents_not_raw_floats() -> None:
    ctx = _titanic_context()
    assert "0.242421" not in ctx  # plus jamais de float brut
    assert "cat__" not in ctx and "num_median_0__" not in ctx
    assert "Sex = female : 24 %" in ctx
    assert "accuracy=0.832" in ctx  # métrique arrondie 3 déc.


def test_build_context_percents_sum_to_about_100() -> None:
    line = next(
        ligne for ligne in _titanic_context().splitlines() if ligne.startswith("Importances")
    )
    percents = [int(m) for m in re.findall(r"(\d+) %", line)]
    assert len(percents) == 3
    assert 97 <= sum(percents) <= 103


def test_build_context_local_contributions_keep_direction() -> None:
    ctx = xai_text.build_context(
        metrics={"accuracy": 0.83},
        importance=[
            {"feature": "cat__Sex_female", "contribution": 0.3},
            {"feature": "num_median_0__Age", "contribution": -0.1},
        ],
        task_type="classification",
        algorithm="random_forest",
        explanation_type="local",
        local_values={
            "prediction": 0.8712345,
            "base_value": 0.62111,
            "predicted_label": "survived",
        },
    )
    assert "Sex = female : 75 % ↗" in ctx
    assert "Age : 25 % ↘" in ctx
    assert "0.871" in ctx and "0.621" in ctx  # valeurs locales arrondies 3 déc.


def test_prompts_ask_to_quote_numbers_as_displayed() -> None:
    _, user_fr = xai_text.build_prompt(audience="novice", language="fr", context="ctx")
    _, user_en = xai_text.build_prompt(audience="novice", language="en", context="ctx")
    assert "tels qu'affichés" in user_fr
    assert "as displayed" in user_en
    chat_fr = xai_text.chat_prompt_v2(question="q", context="ctx", history=[], language="fr")
    chat_en = xai_text.chat_prompt_v2(question="q", context="ctx", history=[], language="en")
    assert "tels qu'affichés" in chat_fr
    assert "as displayed" in chat_en
```

- [ ] **Step 2 : vérifier l'échec** — `uv run pytest tests/unit/test_xai_text.py -q` → FAIL (contexte brut, consignes absentes).

- [ ] **Step 3 : implémentation** — remplacer le corps de `build_context` et ajouter `_importance_line` :

```python
def _importance_line(importance: list[dict[str, Any]]) -> str | None:
    """Importances en « part de l'importance affichée » — mêmes % que les graphiques.

    Dénominateur = Σ|v| de la liste reçue ENTIÈRE (le top stocké, celui que le front
    affiche) : le LLM et les charts citent exactement le même « 24 % ».
    """
    values = [float(i.get("value", i.get("contribution")) or 0) for i in importance]
    total = sum(abs(v) for v in values)
    if not values or total <= 0:
        return None
    signed = any("contribution" in item for item in importance)
    parts = []
    for item, raw in zip(importance, values, strict=True):
        label = humanize_feature(str(item.get("feature", "?")))
        share = format_share(raw, total)
        if signed:
            share += " ↗" if raw >= 0 else " ↘"
        parts.append(f"{label} : {share}")
    header = "Importances (part de l'importance affichée"
    if signed:
        header += ", ↗ pousse la prédiction vers le haut / ↘ vers le bas"
    return header + ") : " + ", ".join(parts)


def build_context(
    *,
    metrics: dict[str, Any],
    importance: list[dict[str, Any]],
    task_type: str,
    algorithm: str,
    explanation_type: str,
    local_values: dict[str, Any] | None,
) -> str:
    lines = [
        f"Algorithme : {algorithm} | Tâche : {task_type} | Type d'explication : {explanation_type}"
    ]
    numeric_metrics = {k: v for k, v in metrics.items() if isinstance(v, (int, float))}
    lines.append(
        "Métriques réelles (arrondies) : "
        + ", ".join(f"{k}={_round3(v)}" for k, v in numeric_metrics.items())
    )
    importance_line = _importance_line(importance)
    if importance_line:
        lines.append(importance_line)
    if local_values:
        lines.append(
            f"Prédiction locale : {_round3(local_values.get('prediction'))} "
            f"(base {_round3(local_values.get('base_value'))}, "
            f"classe {local_values.get('predicted_label')})"
        )
    return "\n".join(lines)
```

Dans `build_prompt`, ajouter la consigne juste avant le bloc CONTEXTE :

```python
    if lang == "fr":
        user = (
            f"Explique ces résultats pour {spec}.\n"
            "Structure : ① ce que le modèle a appris ② quelles variables comptent et pourquoi "
            "③ à quel point s'y fier (métriques) ④ une limite à garder en tête.\n"
            "Cite les nombres tels qu'affichés dans le contexte (arrondis / en %) — "
            "ne re-dérive jamais une précision supérieure.\n\n"
            f"CONTEXTE (seules valeurs autorisées) :\n{context}"
        )
    else:
        user = (
            f"Explain these results for {spec}.\n"
            "Structure: ① what the model learned ② which features matter and why "
            "③ how much to trust it (metrics) ④ one limitation to keep in mind.\n"
            "Quote numbers exactly as displayed in the context (rounded / in %) — "
            "never re-derive extra precision.\n\n"
            f"CONTEXT (only allowed values):\n{context}"
        )
```

Dans `chat_prompt_v2`, même consigne en fin d'instruction (FR : après « … un callout pour une limite. » ; EN : après « … a callout for a limitation. ») :

```python
            "Rédige une réponse claire et STRUCTURÉE en blocs (≤ 6 blocs, ≤ 120 mots au total). "
            "Utilise un tableau ou featureImpact quand cela éclaire vraiment, un callout pour une "
            "limite. Cite les nombres tels qu'affichés dans le contexte (arrondis / en %). "
            "Appuie-toi UNIQUEMENT sur le contexte."
```

```python
        "Write a clear, STRUCTURED answer in blocks (≤ 6 blocks, ≤ 120 words total). "
        "Use a table or featureImpact only when it truly helps, a callout for a limitation. "
        "Quote numbers exactly as displayed in the context (rounded / in %). "
        "Rely ONLY on the context."
```

- [ ] **Step 4 : vérifier le vert** — `uv run pytest tests/unit/test_xai_text.py -q` → PASS (les tests existants `test_fallback_*` restent verts : ils n'utilisent pas `build_context`).

---

### Task 3 : Backend — garde-fou : tolérance symétrique ÷100

**Files:**
- Modify: `apps/api/ibis/modules/llm/xai_text.py` (`numbers_exist_in_context`)
- Test: `apps/api/tests/unit/test_xai_text.py`

**Interfaces:**
- Consumes: `_titanic_context()` (fixture Task 2).
- Produces: garde-fou acceptant « 0,24 » quand le contexte affiche « 24 % » ; tout le reste inchangé (valeur exacte `:g`, arrondis 0–4 déc., ordinaux, log).

- [ ] **Step 1 : tests rouges** :

```python
def test_guard_accepts_percent_and_decimal_echo() -> None:
    ctx = _titanic_context()
    assert xai_text.numbers_exist_in_context("Le sexe pèse environ 24 % ici.", ctx) is True
    # Écho décimal d'un % affiché (24 → 0,24) : toléré via la symétrie ÷100.
    assert xai_text.numbers_exist_in_context("La part du sexe vaut 0,24 environ.", ctx) is True


def test_guard_still_rejects_foreign_numbers() -> None:
    ctx = _titanic_context()
    assert xai_text.numbers_exist_in_context("Le score magique est 0.37.", ctx) is False
```

- [ ] **Step 2 : vérifier l'échec** — le test « 0,24 » échoue (pas encore de ÷100) ; « 24 % » passe déjà.

- [ ] **Step 3 : implémentation** — dans la boucle de `numbers_exist_in_context`, ajouter l'équivalent ÷100 sous la ligne ×100 :

```python
        for digits in (0, 1, 2, 3, 4):
            context_numbers.add(f"{value:.{digits}f}".rstrip("0").rstrip("."))
            context_numbers.add(
                f"{value * 100:.{digits}f}".rstrip("0").rstrip(".")
            )  # % équivalents
            context_numbers.add(
                f"{value / 100:.{digits}f}".rstrip("0").rstrip(".")
            )  # écho décimal d'un % affiché (24 → 0.24)
```

- [ ] **Step 4 : vérifier le vert** — `uv run pytest tests/unit/test_xai_text.py -q` → PASS.

---

### Task 4 : Backend — replis déterministes humanisés (`fallback_text` + `fallback_document`)

**Files:**
- Modify: `apps/api/ibis/modules/llm/xai_text.py` (`fallback_text`, suppression de `_g`)
- Modify: `apps/api/ibis/modules/xai/blocks.py` (`fallback_document`, `_fmt`)
- Test: `apps/api/tests/unit/test_xai_text.py`, `apps/api/tests/unit/test_xai_blocks.py`

**Interfaces:**
- Consumes: `humanize_feature`, `format_share`, `_round3` (Task 1).
- Produces: replis sans aucun `cat__`/`num_…__` ; tableau du repli chat en colonnes `["Variable", "Poids (%)"]` / `["Feature", "Weight (%)"]`, cellules « 24 % » (dénominateur = liste reçue entière, comme le contexte).

- [ ] **Step 1 : tests rouges** — dans `test_xai_text.py` :

```python
def test_fallback_text_humanizes_feature_names() -> None:
    text = xai_text.fallback_text(
        audience="novice",
        language="fr",
        metrics=METRICS,
        importance=TITANIC_IMPORTANCE,
        task_type="classification",
        algorithm="random_forest",
    )
    assert "cat__" not in text and "num_median_0__" not in text
    assert "Sex = female" in text
```

Dans `test_xai_blocks.py` :

```python
def test_fallback_document_humanizes_and_shows_percents() -> None:
    doc = blocks.fallback_document(
        language="fr",
        metrics={"primary_metric": "accuracy", "accuracy": 0.83},
        importance=[
            {"feature": "cat__Sex_female", "value": 0.242421},
            {"feature": "num_median_0__Pclass", "value": 0.5},
            {"feature": "num_median_0__Fare", "value": 0.257579},
        ],
        task_type="classification",
        algorithm="random_forest",
    )
    table = next(b for b in doc.blocks if b.type == "table")
    assert table.columns == ["Variable", "Poids (%)"]
    texts = [cell.text for row in table.rows for cell in row]
    assert "Sex = female" in texts
    assert "24 %" in texts
    assert all("cat__" not in t and "num_median_0__" not in t for t in texts)
```

Et **adapter** `test_fallback_document_is_valid_and_grounded` (le tableau passe en % → le contexte de référence doit être celui que produit `build_context`, comme en prod) :

```python
def test_fallback_document_is_valid_and_grounded() -> None:
    metrics = {"primary_metric": "accuracy", "accuracy": 0.83}
    importance = [{"feature": "revenu", "value": 0.41}, {"feature": "age", "value": 0.19}]
    doc = blocks.fallback_document(
        language="fr",
        metrics=metrics,
        importance=importance,
        task_type="classification",
        algorithm="random_forest",
    )
    assert isinstance(doc, blocks.BlockDocument)
    types = [b.type for b in doc.blocks]
    assert "paragraph" in types and "table" in types and "callout" in types
    # Chaque nombre du fallback existe dans le contexte réellement servi au LLM (build_context).
    context = xai_text.build_context(
        metrics=metrics,
        importance=importance,
        task_type="classification",
        algorithm="random_forest",
        explanation_type="global",
        local_values=None,
    )
    assert xai_text.numbers_exist_in_context(blocks.extract_text(doc), context) is True
```

- [ ] **Step 2 : vérifier l'échec** — `uv run pytest tests/unit/test_xai_text.py tests/unit/test_xai_blocks.py -q` → FAIL.

- [ ] **Step 3 : implémentation.** Dans `xai_text.py` : supprimer `_g` et utiliser `_round3` + `humanize_feature` dans `fallback_text` — remplacements exacts :
  - `top = [str(i["feature"]) for i in importance[:3]]` → `top = [humanize_feature(str(i["feature"])) for i in importance[:3]]`
  - `top = [str(i["feature"]) for i in importance[:5]]` → `top = [humanize_feature(str(i["feature"])) for i in importance[:5]]`
  - les six occurrences `{_g(primary_value)}` → `{_round3(primary_value)}` (novice fr/en, expert fr/en, intermediate fr/en) ; supprimer la fonction `_g` devenue morte.

  Dans `blocks.py` : ajouter l'import (après les imports pydantic) :

```python
from ibis.modules.llm.xai_text import format_share, humanize_feature
```

  puis dans `fallback_document` : colonnes et lignes du tableau :

```python
    if fr:
        table_cols = ["Variable", "Poids (%)"]
```

```python
        table_cols = ["Feature", "Weight (%)"]
```

```python
    top = importance[:6]
    if top:
        values = [float(i.get("value", i.get("contribution")) or 0) for i in importance]
        total = sum(abs(v) for v in values)
        rows: list[list[Cell]] = [
            [
                Cell(text=humanize_feature(str(item.get("feature", "?")))),
                Cell(text=format_share(value, total)),
            ]
            for item, value in zip(importance[:6], values[:6], strict=True)
        ]
        blocks.append(TableBlock(type="table", columns=table_cols, rows=rows))
```

  et dans `_fmt` (métrique de l'intro, 3 déc. max) :

```python
def _fmt(value: Any) -> str:
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, (int, float)):
        return f"{round(float(value), 3):g}"
    return str(value)
```

- [ ] **Step 4 : vérifier le vert** — `uv run pytest tests/unit/test_xai_text.py tests/unit/test_xai_blocks.py -q` → PASS (import `blocks.py` → `llm.xai_text` : sens unique, aucun cycle).

---

### Task 5 : Backend — vérifications complètes API

- [ ] **Step 1 :** `cd apps/api && uv run ruff check . && uv run ruff format --check .` → 0 erreur (reformater via `uv run ruff format .` si besoin).
- [ ] **Step 2 :** `uv run mypy ibis` → Success.
- [ ] **Step 3 :** `uv run pytest -q` → tous verts (dont `test_xai_quality.py` intact, exigence CDC).

---

### Task 6 : Front — miroir `lib/xai/features.ts` (TDD vitest)

**Files:**
- Create: `apps/web/lib/xai/features.ts`
- Test: `apps/web/tests/xai/features.test.ts`

**Interfaces:**
- Produces: `humanizeFeature(name: string): string`, `formatShare(value: number, total: number): string`, `roundLabel(value: unknown): string` — consommés par Task 7.

- [ ] **Step 1 : tests rouges** — créer `apps/web/tests/xai/features.test.ts` :

```ts
import { describe, expect, it } from "vitest";

import { formatShare, humanizeFeature, roundLabel } from "@/lib/xai/features";

describe("humanizeFeature", () => {
  it("should humanize one-hot categorical features", () => {
    expect(humanizeFeature("cat__Sex_female")).toBe("Sex = female");
    expect(humanizeFeature("cat__Embarked_S")).toBe("Embarked = S");
  });

  it("should cut snake_case columns at the last underscore", () => {
    expect(humanizeFeature("cat__niveau_etude_Bac")).toBe("niveau etude = Bac");
  });

  it("should strip numeric transformer prefixes", () => {
    expect(humanizeFeature("num_median_0__Pclass")).toBe("Pclass");
    expect(humanizeFeature("num_mean_2__fare_amount")).toBe("fare amount");
  });

  it("should keep ordinal and plain names unchanged", () => {
    expect(humanizeFeature("cat__Sex")).toBe("Sex");
    expect(humanizeFeature("age")).toBe("age");
  });
});

describe("formatShare", () => {
  it("should mirror the backend share format", () => {
    expect(formatShare(0.242421, 1)).toBe("24 %");
    expect(formatShare(0.125, 1)).toBe("13 %"); // demi-part vers le haut, comme le back
    expect(formatShare(0.003, 1)).toBe("<1 %");
    expect(formatShare(-0.24, 1)).toBe("24 %");
    expect(formatShare(0.5, 0)).toBe("0 %");
  });
});

describe("roundLabel", () => {
  it("should round to 3 decimals max and pass through non-numbers", () => {
    expect(roundLabel(0.8712345)).toBe("0.871");
    expect(roundLabel(0.83)).toBe("0.83");
    expect(roundLabel("survived")).toBe("survived");
  });
});
```

- [ ] **Step 2 : vérifier l'échec** — `cd apps/web && pnpm test` → FAIL (module inexistant).

- [ ] **Step 3 : implémentation** — créer `apps/web/lib/xai/features.ts` :

```ts
// Miroir front de `xai_text.humanize_feature` / `format_share` (apps/api) : mêmes règles,
// mêmes arrondis — le texte du LLM, les replis et les graphiques citent les mêmes nombres.

/** `cat__Sex_female` → « Sex = female », `num_median_0__Pclass` → « Pclass ». */
export function humanizeFeature(name: string): string {
  const sep = name.indexOf("__");
  if (sep === -1) return name;
  const transformer = name.slice(0, sep);
  const rest = name.slice(sep + 2);
  if (!rest) return name;
  if (transformer === "cat" && rest.includes("_")) {
    const cut = rest.lastIndexOf("_");
    return `${rest.slice(0, cut).replace(/_/g, " ")} = ${rest.slice(cut + 1)}`;
  }
  return rest.replace(/_/g, " ");
}

/** « 24 % », « <1 % » sous 0,5 % — demi-parts vers le haut, comme le back. */
export function formatShare(value: number, total: number): string {
  if (total <= 0) return "0 %";
  const pct = (Math.abs(value) / total) * 100;
  return pct < 0.5 ? "<1 %" : `${Math.round(pct)} %`;
}

/** Arrondi lisible 3 décimales max ; les non-nombres passent tels quels. */
export function roundLabel(value: unknown): string {
  const num = typeof value === "number" ? value : Number(value);
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === "")) {
    return String(value ?? "");
  }
  if (!Number.isFinite(num)) return String(value);
  return String(Math.round(num * 1000) / 1000);
}
```

- [ ] **Step 4 : vérifier le vert** — `pnpm test` → PASS.

---

### Task 7 : Front — branchement charts + featureImpact + i18n

**Files:**
- Modify: `apps/web/components/ibis/xai/explanation-view.tsx`
- Modify: `apps/web/components/ibis/xai/ibis-blocks.tsx`
- Modify: `apps/web/messages/fr.json`, `apps/web/messages/en.json`

**Interfaces:**
- Consumes: `humanizeFeature`, `formatShare`, `roundLabel` (Task 6).

- [ ] **Step 1 : `explanation-view.tsx`.** Importer le helper :

```ts
import { formatShare, humanizeFeature, roundLabel } from "@/lib/xai/features";
```

  Avant le `return`, transformer les données de viz (labels humanisés + parts en %) :

```ts
  const importanceTotal = (globalImportance ?? []).reduce(
    (sum, item) => sum + Math.abs(item.value),
    0
  );
  const importanceData = globalImportance?.map((item) => ({
    feature: humanizeFeature(item.feature),
    share: formatShare(item.value, importanceTotal),
    pct: importanceTotal > 0 ? Math.round((Math.abs(item.value) / importanceTotal) * 100) : 0
  }));
  const waterfallData = waterfall?.map((item) => ({
    ...item,
    feature: humanizeFeature(item.feature)
  }));
```

  Chart importance : remplacer `globalImportance` par `importanceData` (`data={[...importanceData].reverse()}`, hauteur sur `importanceData.length`), `Bar dataKey="pct"` et tooltip affichant la part exacte :

```tsx
<ChartTooltip
  content={
    <ChartTooltipContent
      formatter={(_value, _name, item) =>
        (item?.payload as { share?: string })?.share ?? String(_value)
      }
    />
  }
/>
```

  Waterfall : utiliser `waterfallData` (data + Cells) et contributions arrondies dans le tooltip :

```tsx
<ChartTooltip
  content={<ChartTooltipContent formatter={(value) => roundLabel(Number(value))} />}
/>
```

  base_value / prédiction du header waterfall : `String(...)` → `roundLabel(...)` pour `values["base_value"]` et `values["prediction"]`.

  Comparaison SHAP/LIME : `<span className="w-32 truncate">{humanizeFeature(item.feature)}</span>`.

- [ ] **Step 2 : `ibis-blocks.tsx`.** Importer `humanizeFeature` et l'appliquer au rendu `featureImpact` (normalise aussi les anciens messages du chat) :

```tsx
<span className="w-28 shrink-0 truncate" title={humanizeFeature(item.feature)}>
  {humanizeFeature(item.feature)}
</span>
```

- [ ] **Step 3 : i18n.** Dans `messages/fr.json` clé `xai.charts.importanceHint` → « Part de chaque variable dans l'importance affichée (en %) : plus la barre est longue, plus la variable a pesé. » ; `en.json` → "Each feature's share of the displayed importance (in %): the longer the bar, the more that feature mattered." (adapter à la formulation existante si elle contient d'autres précisions — garder les deux langues synchrones).

- [ ] **Step 4 : vérifier** — `pnpm test` (dont `i18n-messages.test.ts` qui contrôle la parité fr/en) → PASS.

---

### Task 8 : Front — vérifications complètes Web

- [ ] **Step 1 :** `cd apps/web && pnpm lint` → 0 erreur.
- [ ] **Step 2 :** `pnpm typecheck` → 0 erreur.
- [ ] **Step 3 :** `pnpm test` → tous verts.
- [ ] **Step 4 :** `pnpm build` → succès.

---

### Task 9 : CHANGELOG + commit unique du lot

- [ ] **Step 1 :** ajouter l'entrée dans `CHANGELOG.md` (emplacement et format des entrées existantes) : « Évolution XAI 1 — nombres lisibles : importances en % (part de l'importance affichée), noms de variables humanisés (contexte LLM, replis, graphiques), garde-fou étendu (écho décimal des %). »
- [ ] **Step 2 :** relire `git status` / `git diff --stat` (fichiers attendus uniquement : `xai_text.py`, `blocks.py`, 2 fichiers de tests API, `features.ts`, `features.test.ts`, `explanation-view.tsx`, `ibis-blocks.tsx`, `fr.json`, `en.json`, CHANGELOG, docs superpowers).
- [ ] **Step 3 :** commit unique :

```bash
git add -A
git commit -m "feat(xai): nombres lisibles — importances en %, variables humanisées (évolution 1)"
```

(Pas de push — attendre la demande explicite.)
