#!/bin/bash
###############################################################################
# FormBuilder GCP — Setup completo desde Cloud Shell
#
# Uso:
#   chmod +x setup-gcp.sh
#   ./setup-gcp.sh
#
# Este script:
#   1. Configura el proyecto GCP y habilita APIs
#   2. Crea el bucket de estado de Terraform
#   3. Ejecuta Terraform (crea infra: Cloud SQL, Cloud Run, Storage, etc.)
#   4. Genera la service account key para GitHub Actions
#   5. Imprime TODAS las variables que necesitas agregar en GitHub Secrets
#
# NOTA: Las API keys (Gemini, Maps, OAuth) NO se manejan aquí.
#       Se almacenan directamente en GitHub Secrets.
###############################################################################

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}\n"; }
print_ok()   { echo -e "${GREEN}✔ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_err()  { echo -e "${RED}✖ $1${NC}"; }

# ─── Paso 0: Recoger datos del usuario ─────────────────────────────────────
print_step "CONFIGURACIÓN INICIAL"

CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
if [ -n "$CURRENT_PROJECT" ]; then
  echo -e "Proyecto GCP actual: ${BOLD}${CURRENT_PROJECT}${NC}"
  read -p "¿Usar este proyecto? (y/n): " USE_CURRENT
  if [[ "$USE_CURRENT" =~ ^[Yy]$ ]]; then
    PROJECT_ID="$CURRENT_PROJECT"
  else
    read -p "Ingresa el Project ID: " PROJECT_ID
  fi
else
  read -p "Ingresa el Project ID de GCP: " PROJECT_ID
fi

read -p "Región GCP [us-central1]: " GCP_REGION
GCP_REGION=${GCP_REGION:-us-central1}

echo ""
echo -e "${BOLD}Resumen:${NC}"
echo "  Project ID: $PROJECT_ID"
echo "  Región:     $GCP_REGION"
echo ""
echo -e "${YELLOW}NOTA: Las API keys (Gemini, Maps, OAuth) se agregan directo en GitHub Secrets.${NC}"
echo -e "${YELLOW}      Este script solo crea la infraestructura de GCP.${NC}"
echo ""
read -p "¿Continuar? (y/n): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Cancelado."
  exit 0
fi

# ─── Paso 1: Configurar proyecto ───────────────────────────────────────────
print_step "PASO 1/6 — Configurando proyecto GCP"

gcloud config set project "$PROJECT_ID"
print_ok "Proyecto configurado: $PROJECT_ID"

BILLING=$(gcloud billing projects describe "$PROJECT_ID" --format="value(billingEnabled)" 2>/dev/null || echo "false")
if [ "$BILLING" != "True" ]; then
  print_err "Billing NO está habilitado en este proyecto."
  echo "    Ve a: https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
  echo "    Habilita billing y vuelve a ejecutar este script."
  exit 1
fi
print_ok "Billing habilitado"

# ─── Paso 2: Habilitar APIs ────────────────────────────────────────────────
print_step "PASO 2/6 — Habilitando APIs de GCP"

APIS=(
  "run.googleapis.com"
  "sqladmin.googleapis.com"
  "sql-component.googleapis.com"
  "secretmanager.googleapis.com"
  "artifactregistry.googleapis.com"
  "cloudbuild.googleapis.com"
  "iam.googleapis.com"
  "sheets.googleapis.com"
  "storage.googleapis.com"
  "compute.googleapis.com"
  "iap.googleapis.com"
  "cloudresourcemanager.googleapis.com"
  "generativelanguage.googleapis.com"
  "maps-backend.googleapis.com"
  "geocoding-backend.googleapis.com"
)

for api in "${APIS[@]}"; do
  echo -n "  $api... "
  gcloud services enable "$api" --quiet 2>/dev/null
  echo "✔"
done
print_ok "Todas las APIs habilitadas"

# ─── Paso 3: Crear bucket de estado de Terraform ──────────────────────────
print_step "PASO 3/6 — Creando bucket para Terraform state"

TF_STATE_BUCKET="formbuilder-tfstate-${PROJECT_ID}"

if gsutil ls "gs://${TF_STATE_BUCKET}" &>/dev/null; then
  print_warn "Bucket ya existe: gs://${TF_STATE_BUCKET}"
else
  gsutil mb -l "$GCP_REGION" "gs://${TF_STATE_BUCKET}"
  gsutil versioning set on "gs://${TF_STATE_BUCKET}"
  print_ok "Bucket creado: gs://${TF_STATE_BUCKET}"
fi

# ─── Paso 4: Configurar y ejecutar Terraform ──────────────────────────────
print_step "PASO 4/6 — Configurando y ejecutando Terraform"

if ! command -v terraform &>/dev/null; then
  print_err "Terraform no encontrado. Instalando..."
  sudo apt-get update && sudo apt-get install -y terraform
fi

TERRAFORM_VERSION=$(terraform version -json | python3 -c "import sys,json; print(json.load(sys.stdin)['terraform_version'])")
print_ok "Terraform v${TERRAFORM_VERSION}"

cd terraform

# Actualizar backend bucket name en main.tf
sed -i "s|bucket = \"formbuilder-tfstate\"|bucket = \"${TF_STATE_BUCKET}\"|g" main.tf
print_ok "Backend bucket actualizado: ${TF_STATE_BUCKET}"

# Crear terraform.tfvars (sin API keys — esas van en GitHub)
cat > terraform.tfvars <<EOF
project_id  = "${PROJECT_ID}"
region      = "${GCP_REGION}"
environment = "prod"

db_tier = "db-f1-micro"
db_name = "formbuilder"
db_user = "formbuilder_app"

backend_image         = ""
frontend_image        = ""
backend_cpu           = "1"
backend_memory        = "512Mi"
backend_max_instances = 5
EOF

print_ok "terraform.tfvars creado (sin API keys — van en GitHub)"

echo ""
echo "Inicializando Terraform..."
terraform init -input=false

echo ""
echo "Planificando..."
terraform plan -input=false -out=tfplan

echo ""
echo -e "${YELLOW}Terraform va a crear:${NC}"
echo "  • Cloud SQL PostgreSQL 15"
echo "  • 2 servicios Cloud Run (backend + frontend)"
echo "  • Cloud Storage bucket (fotos/firmas)"
echo "  • Artifact Registry (Docker images)"
echo "  • Secret Manager (DB password, JWT, Sheets SA key)"
echo "  • 4 Service Accounts + IAM"
echo ""
read -p "¿Aplicar? (y/n): " APPLY_CONFIRM
if [[ ! "$APPLY_CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Puedes aplicar después con: cd terraform && terraform apply tfplan"
  exit 0
fi

terraform apply -input=false tfplan
print_ok "Infraestructura creada"

# ─── Paso 5: Generar SA Key para GitHub ────────────────────────────────────
print_step "PASO 5/6 — Generando credenciales para GitHub Actions"

GH_SA_EMAIL=$(terraform output -raw github_actions_sa_email)
BACKEND_URL=$(terraform output -raw backend_url)
FRONTEND_URL=$(terraform output -raw frontend_url)
DB_CONNECTION=$(terraform output -raw db_connection_name)
MEDIA_BUCKET=$(terraform output -raw media_bucket)
REGISTRY=$(terraform output -raw artifact_registry)
SHEETS_SA_EMAIL=$(terraform output -raw sheets_sa_email)
BACKEND_SA_EMAIL=$(terraform output -raw backend_sa_email)

SA_KEY_FILE="/tmp/github-actions-sa-key.json"
gcloud iam service-accounts keys create "$SA_KEY_FILE" \
  --iam-account="$GH_SA_EMAIL" \
  --quiet

GCP_SA_KEY_B64=$(base64 -w 0 "$SA_KEY_FILE" 2>/dev/null || base64 "$SA_KEY_FILE" | tr -d '\n')
rm -f "$SA_KEY_FILE"
print_ok "Service Account key generada"

cd ..

# ─── Paso 6: Imprimir todo ─────────────────────────────────────────────────
print_step "PASO 6/6 — RESUMEN COMPLETO"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       GITHUB SECRETS — Agregar en tu repositorio de GitHub          ║${NC}"
echo -e "${BOLD}║  Settings → Secrets and variables → Actions → New repository secret ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║                                                                      ║${NC}"
echo -e "${BOLD}║  GENERADOS POR ESTE SCRIPT (copia y pega):                           ║${NC}"
echo -e "${BOLD}║                                                                      ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}GCP_PROJECT_ID${NC}=${PROJECT_ID}"
echo ""
echo -e "${GREEN}GCP_REGION${NC}=${GCP_REGION}"
echo ""
echo -e "${GREEN}GCP_SA_KEY${NC}=${GCP_SA_KEY_B64}"
echo ""

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                                                                      ║${NC}"
echo -e "${BOLD}║  TÚ DEBES AGREGAR ESTAS (de la guía GUIA_API_KEYS.md):              ║${NC}"
echo -e "${BOLD}║                                                                      ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}GEMINI_API_KEY${NC}=<tu key de https://aistudio.google.com/apikey>"
echo ""
echo -e "${YELLOW}GOOGLE_MAPS_API_KEY${NC}=<tu key de APIs & Services → Credentials → API Key>"
echo ""
echo -e "${YELLOW}GOOGLE_OAUTH_CLIENT_ID${NC}=<tu client ID de APIs & Services → Credentials → OAuth 2.0>"
echo ""
echo -e "${YELLOW}GOOGLE_OAUTH_CLIENT_SECRET${NC}=<tu client secret del mismo OAuth 2.0>"
echo ""

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                       URLS DE LOS SERVICIOS                          ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}BACKEND_URL${NC}  = ${BACKEND_URL}"
echo -e "${CYAN}FRONTEND_URL${NC} = ${FRONTEND_URL}"
echo ""

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                   INFORMACIÓN DE INFRAESTRUCTURA                     ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}DB_CONNECTION_NAME${NC} = ${DB_CONNECTION}"
echo -e "${CYAN}MEDIA_BUCKET${NC}       = ${MEDIA_BUCKET}"
echo -e "${CYAN}ARTIFACT_REGISTRY${NC}  = ${REGISTRY}"
echo -e "${CYAN}GITHUB_ACTIONS_SA${NC}  = ${GH_SA_EMAIL}"
echo -e "${CYAN}BACKEND_SA${NC}         = ${BACKEND_SA_EMAIL}"
echo -e "${CYAN}SHEETS_SA${NC}          = ${SHEETS_SA_EMAIL}"
echo ""

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                        TABLA RESUMEN                                 ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║  Secret en GitHub              │ Origen                              ║${NC}"
echo -e "${BOLD}╠════════════════════════════════╪═════════════════════════════════════╣${NC}"
echo -e "${BOLD}║  GCP_PROJECT_ID                │ ✔ Impreso arriba                   ║${NC}"
echo -e "${BOLD}║  GCP_REGION                    │ ✔ Impreso arriba                   ║${NC}"
echo -e "${BOLD}║  GCP_SA_KEY                    │ ✔ Impreso arriba (base64)          ║${NC}"
echo -e "${BOLD}║  GEMINI_API_KEY                │ ✋ aistudio.google.com/apikey       ║${NC}"
echo -e "${BOLD}║  GOOGLE_MAPS_API_KEY           │ ✋ Cloud Console → Credentials      ║${NC}"
echo -e "${BOLD}║  GOOGLE_OAUTH_CLIENT_ID        │ ✋ Cloud Console → OAuth 2.0        ║${NC}"
echo -e "${BOLD}║  GOOGLE_OAUTH_CLIENT_SECRET    │ ✋ Cloud Console → OAuth 2.0        ║${NC}"
echo -e "${BOLD}╚════════════════════════════════╧═════════════════════════════════════╝${NC}"
echo ""
echo -e "  ✔ = Generado por este script (ya lo tienes arriba)"
echo -e "  ✋ = Lo creas tú manualmente en la consola de Google"
echo ""

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                        PRÓXIMOS PASOS                                ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}1.${NC} Agrega los 7 GitHub Secrets en tu repo:"
echo -e "     https://github.com/TU-ORG/formbuilder-gcp/settings/secrets/actions"
echo ""
echo -e "  ${BOLD}2.${NC} Haz push del código:"
echo -e "     ${CYAN}git init && git remote add origin https://github.com/TU-ORG/formbuilder-gcp.git${NC}"
echo -e "     ${CYAN}git add . && git commit -m 'Initial commit' && git push -u origin main${NC}"
echo ""
echo -e "  ${BOLD}3.${NC} GitHub Actions desplegará backend y frontend automáticamente"
echo -e "     Las API keys se inyectan desde GitHub Secrets al Cloud Run"
echo ""
echo -e "  ${BOLD}4.${NC} Después del primer deploy, configura OAuth redirect URIs:"
echo -e "     https://console.cloud.google.com/apis/credentials?project=${PROJECT_ID}"
echo -e "     Edita tu OAuth Client → Authorized JS origins, agrega:"
echo -e "     ${CYAN}${FRONTEND_URL}${NC}"
echo -e "     ${CYAN}${BACKEND_URL}${NC}"
echo ""
echo -e "  ${BOLD}5.${NC} Comparte Google Sheets con esta service account:"
echo -e "     ${CYAN}${SHEETS_SA_EMAIL}${NC}"
echo ""

echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✔ Infraestructura lista. Agrega los 7 secrets en GitHub y haz push.${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════════════${NC}"
echo ""
