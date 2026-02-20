# Deployment and Rollback Guide

This document describes how to deploy the audit_app stack to production using Docker Compose with Traefik for TLS termination, and how to roll back safely.

## Overview

Components:

- reverse-proxy (Traefik v2): TLS termination via Let’s Encrypt, routes frontend and backend
- backend (FastAPI): non-root user, healthcheck, behind Traefik
- frontend (Next.js): non-root user, healthcheck, behind Traefik
- etl (Python workers): non-root user, writes to /app/downloads only
- postgres (15): persisted volume
- redis (7-alpine): cache

Key hardening:

- Non-root users in app containers
- no-new-privileges security option
- Read-only filesystem for frontend/backend (tmpfs mounted at /tmp)
- Resource limits (cpu/memory) per service
- Healthchecks and restart policies

## Environments and branch mapping

We run three isolated environments with separate hosts and SSH targets:

- dev — auto-deploys from the `develop` branch using `docker-compose.dev.yml` (HTTP only, mirrors prod topology without TLS). Used for integration tests against a deployed stack.
- qa — manual QA validation from `qa` or `release/*` branches using `docker-compose.qa.yml` (Traefik + TLS). Mirrors production closely.
- prod — deploys from tags `vX.Y.Z` (or protected merges to `main`) using `docker-compose.prod.yml` (Traefik + TLS + hardening).

The CI workflow builds/pushes images and selects the tag:

- `dev` for the `develop` branch
- `qa` for `qa` or `release/*` branches
- `latest` for `main`
- the tag name for releases (`vX.Y.Z`)

## Prerequisites

- Docker Engine and Docker Compose V2
- DNS records pointing to your hosts
  - FRONTEND_HOST (e.g., app.example.com)
  - BACKEND_HOST (e.g., api.example.com)
- Let’s Encrypt email for certificate issuance
- Set a strong POSTGRES_PASSWORD

Create a `.env.prod` file at repository root:

```bash
FRONTEND_HOST=app.example.com
BACKEND_HOST=api.example.com
LETSENCRYPT_EMAIL=ops@example.com
POSTGRES_PASSWORD=change-me
```

## Build and deploy

1. Build images

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache
```

1. Start stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

1. Verify

```bash
# Backend health
curl -fsS https://$BACKEND_HOST/health

# Frontend home
curl -I https://$FRONTEND_HOST/

# Certificates status (Traefik log)
docker logs -f $(docker ps -q -f name=reverse-proxy)
```

## Zero-downtime updates

- Build new images with a version tag (recommended) and update the compose file to use image: owner/app:version
- Use `docker compose up -d` to recreate services; Traefik will keep previous connections until new instances are healthy.

## Rollback plan

- Keep previous image tags available in your registry
- To roll back:

```bash
# Point services to the previous tags or previous commit build
# then
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

- PostgreSQL data persists in `postgres_data` volume; if a schema migration failed, run your migration rollback (alembic downgrade) inside the backend container.

## CI/CD pipeline (example)

Using GitHub Actions:

- On push to main or a release tag:
  - Lint and run tests
  - Build and push images to your registry (e.g., ghcr.io or Docker Hub) with the commit SHA and a semver tag
  - Deploy by SSH (or use your orchestrator), pulling the new tags and running `docker compose up -d`

Example job steps:

- Build images with `docker buildx` and `--push` for multi-arch
- Use environment variables/secrets for registry credentials and .env.prod content

### Required GitHub Secrets/Vars

Add these in your repository Settings → Secrets and variables → Actions:

- secrets.DOCKERHUB_USERNAME — your Docker Hub username
- secrets.DOCKERHUB_TOKEN — a Docker Hub Personal Access Token with read/write to your namespace
- secrets.DOCKERHUB_NAMESPACE — your Docker Hub namespace (e.g., myorg)
- secrets.PROD_SSH_HOST — production host/IP for SSH deploy
- secrets.PROD_SSH_USER — SSH username
- secrets.PROD_SSH_KEY — private key (PEM) for the SSH user
- secrets.PROD_APP_DIR — absolute path on the server where docker-compose.prod.yml lives
- (optional) secrets.PROD_SSH_PORT — SSH port if not 22

The workflow `.github/workflows/docker-build-deploy.yml` builds and pushes these images:

- `${DOCKERHUB_NAMESPACE}/audit-app-backend:<tag>`
- `${DOCKERHUB_NAMESPACE}/audit-app-frontend:<tag>`
- `${DOCKERHUB_NAMESPACE}/audit-app-etl:<tag>`

It computes `<tag>` as:

- `latest` on pushes to `main`
- the release tag name on `refs/tags/v*.*.*`

At deploy time, the workflow sets environment variables `BACKEND_IMAGE`, `FRONTEND_IMAGE`, and `ETL_IMAGE` for the `docker compose` command, which override the defaults in `docker-compose.prod.yml`. This enables easy rollbacks by re-deploying a previous tag.

### Environment-specific deploy

- Dev deploy (develop):

```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev pull
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d
```

- QA deploy (qa or release/\*):

```bash
docker compose -f docker-compose.qa.yml --env-file .env.qa pull
docker compose -f docker-compose.qa.yml --env-file .env.qa up -d
```

## Operational runbooks

- Monitor health via:
  - Backend: /health endpoint
  - Traefik dashboard (optional)
- Logs: json-file driver with rotation; aggregate with your log stack (ELK/Vector/Datadog) as needed
- Backups:
  - Nightly logical dumps or volume snapshots for `postgres_data`
- Security:
  - Rotate POSTGRES_PASSWORD periodically
  - Ensure only 80/443 are exposed; backend and frontend are reachable through Traefik only

## Notes

- ETL service requires write access to `/app/downloads` (mounted volume); everything else remains read-only or non-privileged
- For Kubernetes deployments, mirror these settings via PodSecurityContext (runAsUser), SecurityContext (readOnlyRootFilesystem, allowPrivilegeEscalation=false), resource requests/limits, and Ingress TLS
