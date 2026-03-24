###############################################################################
# FormBuilder GCP — IAM (Service Accounts & Permissions)
###############################################################################

# ─── Backend Service Account ────────────────────────────────────────────────

resource "google_service_account" "backend" {
  account_id   = "formbuilder-backend"
  display_name = "FormBuilder Backend Service"
  description  = "Service account for backend Cloud Run service"
}

# Backend needs: Cloud SQL, Secret Manager, Cloud Storage, Sheets API
resource "google_project_iam_member" "backend_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/storage.objectAdmin",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.backend.email}"
}

# ─── Frontend Service Account ───────────────────────────────────────────────

resource "google_service_account" "frontend" {
  account_id   = "formbuilder-frontend"
  display_name = "FormBuilder Frontend Service"
  description  = "Service account for frontend Cloud Run service"
}

# ─── Sheets Service Account ────────────────────────────────────────────────

resource "google_service_account" "sheets" {
  account_id   = "formbuilder-sheets"
  display_name = "FormBuilder Google Sheets Sync"
  description  = "Service account for Google Sheets API integration"
}

resource "google_service_account_key" "sheets_key" {
  service_account_id = google_service_account.sheets.name
}

# Store the sheets SA key in Secret Manager
resource "google_secret_manager_secret" "sheets_sa_key" {
  secret_id = "sheets-sa-key"

  replication {
    auto {}
  }

  labels = local.labels

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "sheets_sa_key" {
  secret      = google_secret_manager_secret.sheets_sa_key.id
  secret_data = google_service_account_key.sheets_key.private_key
}

# ─── GitHub Actions Service Account (for CI/CD) ────────────────────────────

resource "google_service_account" "github_actions" {
  account_id   = "formbuilder-github-actions"
  display_name = "FormBuilder GitHub Actions"
  description  = "Service account for CI/CD deployments"
}

resource "google_project_iam_member" "github_actions_roles" {
  for_each = toset([
    "roles/run.admin",
    "roles/artifactregistry.writer",
    "roles/iam.serviceAccountUser",
    "roles/cloudsql.client",
    "roles/storage.admin",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}
