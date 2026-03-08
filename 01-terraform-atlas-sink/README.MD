# Confluent Cloud + MongoDB Atlas Stream Demo (Terraform)

Minimal Terraform demo that provisions:
- Confluent Cloud resources (env, cluster, topic, connectors)
- MongoDB Atlas project, cluster, DB user, IP allowlist
- Datagen source + MongoDB Atlas sink connector
- TODO ASP

Prerequisites
- Terraform installed
- Confluent Cloud API key/secret
- MongoDB Atlas public/private API keys

Quickstart
1. Create a `terraform.tfvars` with required variables (see `variables.tf`).
2. Initialize:
   - terraform init
3. Validate:
   - terraform validate
4. Plan:
   - terraform plan -out plan.tfplan
5. Apply:
   - terraform apply plan.tfplan
6. Destroy when finished:
   - terraform destroy

Notes
- Sensitive values should go in `terraform.tfvars` or environment variables.
- Review provider versions in `main.tf` before running.

```// filepath: /Users/jeff/sandbox/terraform/README.MD
# Confluent Cloud + MongoDB Atlas Stream Demo (Terraform)

Minimal Terraform demo that provisions:
- Confluent Cloud resources (env, cluster, topic, connectors)
- MongoDB Atlas project, cluster, DB user, IP allowlist
- Datagen source + MongoDB Atlas sink connector

Prerequisites
- Terraform installed
- Confluent Cloud API key/secret
- MongoDB Atlas public/private API keys

Quickstart
1. Create a `terraform.tfvars` with required variables (see `variables.tf`).
terr   - terraform init
3. Validate:
   - terraform validate
4. Plan:
   - terraform plan -out plan.tfplan
5. Apply:
   - terraform apply plan.tfplan
6. Destroy when finished:
   - terraform destroy

Notes
- Sensitive values should go in `terraform.tfvars` or environment variables.
- Review provider versions in `main.tf` before running.
