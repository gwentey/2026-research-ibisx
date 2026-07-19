#!/usr/bin/env bash
# deploy/check-env.sh — garde-fou .env pour IBIS-X en production.
#
# Usage :  ./deploy/check-env.sh [chemin/vers/.env]     (défaut : .env à la racine)
#
# - Sort en ERREUR (code 1) si une variable REQUISE manque, est vide ou reste un placeholder
#   → utilisable comme étape bloquante dans la CI ou au démarrage sur la VM.
# - Signale (sans bloquer) les clés présentes dans .env.example mais ABSENTES du .env
#   → c'est le cas « le .env.example a évolué et j'ai oublié une propriété sur la VM ».
set -euo pipefail

ENV_FILE="${1:-.env}"
EXAMPLE_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env.example"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
grn() { printf '\033[32m%s\033[0m\n' "$*"; }
ylw() { printf '\033[33m%s\033[0m\n' "$*"; }

[ -f "$ENV_FILE" ] || { red "❌ Fichier introuvable : $ENV_FILE"; exit 1; }

# Lit la valeur d'une clé dans un .env (dernière occurrence, guillemets basiques retirés).
getval() {
  { grep -E "^[[:space:]]*$1=" "$2" 2>/dev/null || true; } \
    | tail -n1 \
    | sed -E "s/^[[:space:]]*$1=//" \
    | sed -E 's/[[:space:]]+#.*$//' \
    | sed -E 's/^"(.*)"$/\1/'
}

# Variables OBLIGATOIRES en production (déploiement refusé si absentes / placeholder).
REQUIRED=(JWT_SECRET POSTGRES_PASSWORD INITIAL_ADMIN_EMAIL INITIAL_ADMIN_PASSWORD)

# Valeurs "placeholder" à rejeter (issues du .env.example).
is_placeholder() {
  case "$1" in
    ""|"ibis"|*CHANGE-ME*|*change-me*|"dev-only-secret-change-me-0000000000000000") return 0 ;;
  esac
  return 1
}

errors=0

echo "── Variables REQUISES (${ENV_FILE}) ──"
for key in "${REQUIRED[@]}"; do
  val="$(getval "$key" "$ENV_FILE")"
  if is_placeholder "$val"; then
    red "  ❌ $key manquante ou placeholder"
    errors=$((errors + 1))
  else
    grn "  ✅ $key"
  fi
done

env_val="$(getval ENVIRONMENT "$ENV_FILE")"
[ "$env_val" = "production" ] || ylw "  ⚠️  ENVIRONMENT=${env_val:-<vide>} (attendu : production)"

echo ""
echo "── Clés du .env.example absentes de ${ENV_FILE} (évolution du modèle) ──"
missing=0
if [ -f "$EXAMPLE_FILE" ]; then
  while IFS= read -r key; do
    [ -z "$key" ] && continue
    if ! grep -qE "^[[:space:]]*$key=" "$ENV_FILE"; then
      ylw "  ⚠️  $key présente dans .env.example, absente de ton .env"
      missing=$((missing + 1))
    fi
  done < <(grep -E '^[[:space:]]*[A-Z_][A-Z0-9_]*=' "$EXAMPLE_FILE" \
             | sed -E 's/^[[:space:]]*([A-Z_][A-Z0-9_]*)=.*/\1/' | sort -u)
  [ "$missing" -eq 0 ] && grn "  ✅ aucune nouvelle clé oubliée"
else
  ylw "  (.env.example introuvable : $EXAMPLE_FILE)"
fi

echo ""
echo "── Recommandations production (non bloquant) ──"
[ -z "$(getval SMTP_HOST "$ENV_FILE")" ] && \
  ylw "  ⚠️  SMTP_HOST vide → reset de mot de passe non envoyé (le lien est seulement loggé)"
if [ -n "$(getval GOOGLE_CLIENT_ID "$ENV_FILE")" ]; then
  case "$(getval OAUTH_REDIRECT_URL "$ENV_FILE")" in
    *localhost*) ylw "  ⚠️  OAUTH_REDIRECT_URL pointe encore sur localhost" ;;
  esac
fi

echo ""
if [ "$errors" -gt 0 ]; then
  red "❌ $errors variable(s) requise(s) invalide(s) — déploiement refusé."
  exit 1
fi
grn "✅ .env valide pour la production."
