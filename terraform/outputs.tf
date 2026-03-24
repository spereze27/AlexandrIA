###############################################################################
# FormBuilder GCP — Terraform Outputs
###############################################################################

output "backend_url" {
  description = "Backend Cloud Run service URL"
  value       = google_cloud_run_v2_service.backend.uri
}

output "frontend_url" {
  description = "Frontend Cloud Run service URL"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "db_connection_name" {
  description = "Cloud SQL connection name (for Cloud Run proxy)"
  value       = google_sql_database_instance.main.connection_name
}

output "db_instance_ip" {
  description = "Cloud SQL public IP"
  value       = google_sql_database_instance.main.public_ip_address
}

output "media_bucket" {
  description = "Cloud Storage bucket for media files"
  value       = google_storage_bucket.media.name
}

output "artifact_registry" {
  description = "Artifact Registry repository path"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}

output "backend_sa_email" {
  description = "Backend service account email"
  value       = google_service_account.backend.email
}

output "github_actions_sa_email" {
  description = "GitHub Actions service account email"
  value       = google_service_account.github_actions.email
}

output "sheets_sa_email" {
  description = "Google Sheets service account email (share sheets with this)"
  value       = google_service_account.sheets.email
}
