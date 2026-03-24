###############################################################################
# FormBuilder GCP — Terraform Variables
###############################################################################

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region for all resources"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

# ─── Cloud SQL ──────────────────────────────────────────────────────────────

variable "db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "formbuilder"
}

variable "db_user" {
  description = "PostgreSQL application user"
  type        = string
  default     = "formbuilder_app"
}

# ─── Cloud Run ──────────────────────────────────────────────────────────────

variable "backend_image" {
  description = "Backend Docker image (full path in Artifact Registry)"
  type        = string
  default     = ""
}

variable "frontend_image" {
  description = "Frontend Docker image (full path in Artifact Registry)"
  type        = string
  default     = ""
}

variable "backend_cpu" {
  description = "Backend Cloud Run CPU"
  type        = string
  default     = "1"
}

variable "backend_memory" {
  description = "Backend Cloud Run memory"
  type        = string
  default     = "512Mi"
}

variable "backend_max_instances" {
  description = "Backend max instances"
  type        = number
  default     = 5
}

variable "frontend_cpu" {
  description = "Frontend Cloud Run CPU"
  type        = string
  default     = "1"
}

variable "frontend_memory" {
  description = "Frontend Cloud Run memory"
  type        = string
  default     = "256Mi"
}

# ─── Secrets (initial values — rotate after deploy) ─────────────────────────

variable "gemini_api_key" {
  description = "Google Gemini API key"
  type        = string
  sensitive   = true
}

variable "google_maps_api_key" {
  description = "Google Maps JavaScript API key"
  type        = string
  sensitive   = true
}

variable "google_oauth_client_id" {
  description = "Google OAuth 2.0 Client ID"
  type        = string
  sensitive   = true
}

variable "google_oauth_client_secret" {
  description = "Google OAuth 2.0 Client Secret"
  type        = string
  sensitive   = true
}
