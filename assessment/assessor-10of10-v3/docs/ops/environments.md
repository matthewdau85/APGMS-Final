# Environments

## Environments
- local (developer workstation)
- dev (shared)
- staging (pre-prod)
- production

## Separation controls
- Separate databases per environment
- Separate secrets per environment
- Separate logging sinks per environment

## Deployment notes
- Use CI/CD to promote build artifacts from staging to production.
- Avoid manual changes in production.
