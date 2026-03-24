###############################################################################
# FormBuilder GCP — Secret Manager
###############################################################################

# ─── Gemini API Key ─────────────────────────────────────────────────────────

resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "gemini-api-key"

  replication {
    auto {}
  }

  labels = local.labels

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "gemini_api_key" {
  secret      = google_secret_manager_secret.gemini_api_key.id
  secret_data = var.gemini_api_key
}

# ─── Google Maps API Key ────────────────────────────────────────────────────

resource "google_secret_manager_secret" "maps_api_key" {
  secret_id = "google-maps-api-key"

  replication {
    auto {}
  }

  labels = local.labels

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "maps_api_key" {
  secret      = google_secret_manager_secret.maps_api_key.id
  secret_data = var.google_maps_api_key
}

# ─── Google OAuth Client ID ─────────────────────────────────────────────────

resource "google_secret_manager_secret" "oauth_client_id" {
  secret_id = "google-oauth-client-id"

  replication {
    auto {}
  }

  labels = local.labels

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "oauth_client_id" {
  secret      = google_secret_manager_secret.oauth_client_id.id
  secret_data = var.google_oauth_client_id
}

# ─── Google OAuth Client Secret ─────────────────────────────────────────────

resource "google_secret_manager_secret" "oauth_client_secret" {
  secret_id = "google-oauth-client-secret"

  replication {
    auto {}
  }

  labels = local.labels

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "oauth_client_secret" {
  secret      = google_secret_manager_secret.oauth_client_secret.id
  secret_data = var.google_oauth_client_secret
}

# ─── JWT Secret (for session tokens) ────────────────────────────────────────

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
