###############################################################################
# FormBuilder GCP — Cloud Storage (Media: photos, signatures, files)
###############################################################################

resource "google_storage_bucket" "media" {
  name     = "formbuilder-media-${local.name_suffix}"
  location = var.region

  uniform_bucket_level_access = true
  force_destroy               = var.environment != "prod"

  versioning {
    enabled = false
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "PUT", "POST", "OPTIONS"]
    response_header = ["Content-Type", "Content-Disposition"]
    max_age_seconds = 3600
  }

  labels = local.labels

  depends_on = [google_project_service.apis["storage.googleapis.com"]]
}

# Allow backend SA to manage objects
resource "google_storage_bucket_iam_member" "backend_storage" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.backend.email}"
}
