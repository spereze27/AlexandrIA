###############################################################################
# FormBuilder GCP — Secret Manager
# Solo secrets auto-generados por Terraform.
# Las API keys (Gemini, Maps, OAuth) se almacenan en GitHub Secrets
# y se inyectan en Cloud Run via GitHub Actions al hacer deploy.
###############################################################################

# ─── JWT Secret (auto-generated) ────────────────────────────────────────────

resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "jwt-secret"

  replication {
    auto {}
  }

  labels = local.labels

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = random_password.jwt_secret.result
}
