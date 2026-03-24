###############################################################################
# FormBuilder GCP — Artifact Registry
###############################################################################

resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = "formbuilder"
  description   = "Docker images for FormBuilder services"
  format        = "DOCKER"

  cleanup_policies {
    id     = "keep-last-5"
    action = "KEEP"

    most_recent_versions {
      keep_count = 5
    }
  }

  labels = local.labels

  depends_on = [google_project_service.apis["artifactregistry.googleapis.com"]]
}
