###############################################################################
# FormBuilder Frontend — Multi-stage Dockerfile
# React + Vite build → Nginx serve (with PWA/service worker support)
###############################################################################

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build args for env vars baked into the build
ARG VITE_API_URL=""
ARG VITE_GOOGLE_MAPS_API_KEY=""
ARG VITE_GOOGLE_OAUTH_CLIENT_ID=""

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_OAUTH_CLIENT_ID=$VITE_GOOGLE_OAUTH_CLIENT_ID

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --no-audit

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config for SPA + PWA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run expects port 3000
EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
