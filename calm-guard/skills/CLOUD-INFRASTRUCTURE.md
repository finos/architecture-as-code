# Cloud Infrastructure — AWS Terraform Skill Guide

## Philosophy

Generate production-realistic AWS Terraform scaffolds derived from CALM architecture signals.
Every resource maps to an architectural decision visible in the CALM document — node types,
protocols, relationships, and controls. Infrastructure teams should see exactly which CALM
elements drove each Terraform resource.

## CALM Signal → AWS Resource Mapping

| CALM Element | AWS Resource | Notes |
|--------------|-------------|-------|
| `network` node | `aws_vpc` + `aws_subnet` (public/private pair) | Segmentation boundary |
| `service` node | `aws_ecs_cluster`, `aws_ecs_service`, `aws_lb` | ALB for external-facing |
| `database` node | `aws_db_instance` (RDS), `aws_db_subnet_group` | Private subnet only |
| `webclient` node | `aws_cloudfront_distribution` | Edge delivery for web apps |
| `HTTPS` on connects | `aws_acm_certificate`, ALB listener port 443 | Auto-redirect 80→443 |
| `mTLS` on connects | `aws_acmpca_certificate_authority` | Private CA hierarchy |
| `deployed-in` rel (container) | `aws_ecs_task_definition` with cluster ref | Container placement |
| `composed-of` rel | Module grouping (nested Terraform modules) | Logical composition |
| Node controls | `aws_iam_role`, `aws_iam_policy` | Least-privilege IAM |

## File Organization

Generate Terraform modules as separate files:
- `terraform/main.tf` — Provider config, locals, data sources
- `terraform/vpc.tf` — VPC, subnets, route tables, IGW, NAT
- `terraform/ecs.tf` — ECS cluster, task definitions, services, ALB
- `terraform/rds.tf` — RDS instance, parameter group, subnet group
- `terraform/security-groups.tf` — Ingress/egress rules per CALM protocol
- `terraform/iam.tf` — Roles and policies per node controls

Only generate files relevant to the CALM document. If no database nodes, skip rds.tf.

## Resource Selection Rules (based on CALM signals)

| CALM Signal | Required Resources |
|-------------|-------------------|
| ANY architecture | VPC, subnets, security groups (always) |
| Has `database` nodes | RDS instance, DB subnet group, DB security group |
| Has `service` nodes | ECS cluster, ECS service, ALB, target group |
| Has `webclient` nodes | CloudFront distribution, S3 bucket (optional) |
| Uses HTTPS | ACM certificate, HTTPS listener on ALB |
| Uses mTLS | ACM Private CA, client certificate |
| Has controls on nodes | IAM roles with least-privilege policies |
| `deployed-in` relationships | ECS task placements matching container topology |

## Terraform Constraints

- Use Terraform 1.5+ with AWS provider ~> 5.0
- Use `us-east-1` as default region (financial services standard)
- Tag all resources with `Project = "calmguard"` and `ManagedBy = "terraform"`
- Use data sources for AZs (`data.aws_availability_zones.available`)
- Private subnets for databases, public subnets for load balancers
- Security group rules derived directly from CALM protocol requirements
- HTTPS → allow 443, deny 80 on ALB listeners
- Database → restrict ingress to service security group only
- Add comments mapping each resource to CALM element (e.g., "# CALM: database node 'trade-db'")

## Traceability

For EVERY Terraform resource, record:
- Which CALM element (node unique-id or relationship unique-id) drove its creation
- The generated AWS resource identifier (e.g., `aws_security_group.app_sg`)
- Why this resource is needed (mapping rationale)

## Formatting Rules

- All HCL strings MUST contain real newline characters
- Use 2-space indentation for HCL blocks
- Add comments on security-critical lines (e.g., "# PCI-DSS: encrypt data at rest")
- No markdown fencing in output strings
