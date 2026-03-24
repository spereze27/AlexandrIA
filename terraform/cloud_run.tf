###############################################################################
# FormBuilder GCP — Cloud Run Services (Backend + Frontend)
###############################################################################

locals {
  registry_prefix = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"

  # Use placeholder images for initial deploy, real images come from CI/CD
  backend_image  = var.backend_image != "" ? var.backend_image : "us-docker.pkg.dev/cloudrun/container/hello"
  frontend_image = var.frontend_image != "" ? var.frontend_image : "us-docker.pkg.dev/cloudrun/container/hello"
}

# ─── Backend Service ────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "backend" {
  name     = "formbuilder-backend"
  location = var.region

  template {
    service_account = google_service_account.backend.email

    scaling {
      min_instance_count = 0
      max_instance_count = var.backend_max_instances
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    containers {
      image = local.backend_image
      name  = "backend"

      resources {
        limits = {
          cpu    = var.backend_cpu
          memory = var.backend_memory
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      ports {
        container_port = 8000
      }

      # ── Database ──
      env {
        name  = "DB_HOST"
        value = "/cloudsql/${google_sql_database_instance.main.connection_name}"
      }
      env {
        name  = "DB_NAME"
        value = var.db_name
      }
      env {
        name  = "DB_USER"
        value = var.db_user
      }
      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }

      # ── Gemini ──
      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini_api_key.secret_id
            version = "latest"
          }
        }
      }

      # ── Google OAuth ──
      env {
        name = "GOOGLE_OAUTH_CLIENT_ID"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.oauth_client_id.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "GOOGLE_OAUTH_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.oauth_client_secret.secret_id
            version = "latest"
          }
        }
      }

      # ── JWT ──
      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }

      # ── Google Sheets SA Key ──
      env {
        name = "GOOGLE_SHEETS_SA_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.sheets_sa_key.secret_id
            version = "latest"
          }
        }
      }

      # ── Cloud Storage ──
      env {
        name  = "GCS_BUCKET_NAME"
        value = google_storage_bucket.media.name
      }

      # ── General ──
      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      env {
        name  = "FRONTEND_URL"
        value = "https://${google_cloud_run_v2_service.frontend.uri}"
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8000
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8000
        }
        period_seconds = 30
      }
    }
  }

  labels = local.labels

  depends_on = [
    google_project_service.apis["run.googleapis.com"],
    google_secret_manager_secret_version.db_password,
    google_secret_manager_secret_version.gemini_api_key,
    google_secret_manager_secret_version.oauth_client_id,
    google_secret_manager_secret_version.oauth_client_secret,
    google_secret_manager_secret_version.jwt_secret,
    google_secret_manager_secret_version.sheets_sa_key,
  ]

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,  # Image is managed by CI/CD
    ]
  }
}

# Allow unauthenticated access (auth handled at app level)
resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ─── Frontend Service ───────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "frontend" {
  name     = "formbuilder-frontend"
  location = var.region

  template {
    service_account = google_service_account.frontend.email

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    containers {
      image = local.frontend_image
      name  = "frontend"

      resources {
        limits = {
          cpu    = var.frontend_cpu
          memory = var.frontend_memory
        }
        cpu_idle = true
      }

      ports {
        container_port = 3000
      }

      env {
        name  = "VITE_API_URL"
        value = ""  # Set after backend deploys, or use relative /api proxy
      }
      env {
        name  = "VITE_GOOGLE_MAPS_API_KEY"
        value = var.google_maps_api_key
      }
      env {
        name  = "VITE_GOOGLE_OAUTH_CLIENT_ID"
        value = var.google_oauth_client_id
      }
    }
  }

  labels = local.labels

  depends_on = [google_project_service.apis["run.googleapis.com"]]

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
