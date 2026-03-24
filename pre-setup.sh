#!/bin/bash
###############################################################################
# pre-setup.sh — Corre ANTES de setup-gcp.sh
# Habilita APIs extras y te dice qué links abrir para crear las API keys
# que vas a guardar en GitHub Secrets (NO en GCP)
###############################################################################

set -euo pipefail

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
echo ""
echo "Proyecto: $PROJECT_ID"
echo ""

echo "━━━ Habilitando APIs necesarias ━━━"
echo ""

APIS=(
  "generativelanguage.googleapis.com"
  "maps-backend.googleapis.com"
  "geocoding-backend.googleapis.com"
  "iap.googleapis.com"
)

for api in "${APIS[@]}"; do
  echo -n "  $api... "
  gcloud services enable "$api" --quiet 2>/dev/null && echo "✔" || echo "✖ (habilítala manualmente)"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ABRE ESTOS 3 LINKS para obtener las API keys"
echo "  Las vas a guardar DIRECTO EN GITHUB (no en GCP)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1) GEMINI_API_KEY:"
echo "     https://aistudio.google.com/apikey"
echo "     → Create API Key → Selecciona '$PROJECT_ID' → Copia"
echo "     → Guarda en GitHub: Settings → Secrets → GEMINI_API_KEY"
echo ""
echo "  2) GOOGLE_MAPS_API_KEY:"
echo "     https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
echo "     → + Create Credentials → API Key → Copia"
echo "     → Guarda en GitHub: Settings → Secrets → GOOGLE_MAPS_API_KEY"
echo ""
echo "  3) GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET:"
echo ""
echo "     Primero configura el consent screen:"
echo "     https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
echo "     → External → Create → Nombre: 'FormBuilder' → Save"
echo ""
echo "     Luego crea las credenciales:"
echo "     https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
echo "     → + Create Credentials → OAuth client ID"
echo "     → Web application → Nombre: 'FormBuilder Web'"
echo "     → Authorized JS origins: http://localhost:5173"
echo "     → Create → Copia Client ID y Client Secret"
echo "     → Guarda en GitHub: GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Cuando tengas las 4 keys guardadas en GitHub Secrets, corre:"
echo "    ./setup-gcp.sh"
echo "  (este script crea la infra GCP y te da las 3 keys restantes)"
echo ""
echo "  Total de secrets en GitHub: 7"
echo "    ✋ Tú creas:   GEMINI_API_KEY, GOOGLE_MAPS_API_KEY,"
echo "                   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET"
echo "    ✔ Script da:  GCP_PROJECT_ID, GCP_REGION, GCP_SA_KEY"
echo ""
