###############################################################################
# FormBuilder GCP — Cloud SQL (PostgreSQL 15)
###############################################################################

resource "google_sql_database_instance" "main" {
  name             = "formbuilder-db-${local.name_suffix}"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = var.db_tier
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    disk_autoresize   = true
    disk_size         = 10
    disk_type         = "PD_SSD"

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = var.environment == "prod"
      start_time                     = "03:00"
      backup_retention_settings {
        retained_backups = 7
      }
    }

    ip_configuration {
      ipv4_enabled = true
      # Cloud Run connects via Cloud SQL Auth Proxy (unix socket)
      # No public IP access needed for the app
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }

    insights_config {
      query_insights_enabled  = true
      record_application_tags = true
    }
  }

  deletion_protection = var.environment == "prod"

  labels = local.labels

  depends_on = [google_project_service.apis["sqladmin.googleapis.com"]]
}

# ─── Database ───────────────────────────────────────────────────────────────

resource "google_sql_database" "formbuilder" {
  name     = var.db_name
  instance = google_sql_database_instance.main.name
}

# ─── Application user ──────────────────────────────────────────────────────

resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "google_sql_user" "app" {
  name     = var.db_user
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

# Store DB password in Secret Manager
resource "google_secret_manager_secret" "db_password" {
  secret_id = "db-password"

  replication {
    auto {}
  }

  labels = local.labels

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}
