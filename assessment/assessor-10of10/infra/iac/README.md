# Infrastructure-as-code (IAC)

This folder is a scaffold for production deployment IAC.

Add one of:
- Terraform
- CloudFormation
- Pulumi
- Kubernetes manifests (with GitOps)

Minimum expectations for production:
- environment separation (dev/staging/prod)
- data residency configuration documented and enforced
- secrets stored outside repo (KMS/Secrets Manager)
- network controls and least privilege IAM
- logging/monitoring wired
