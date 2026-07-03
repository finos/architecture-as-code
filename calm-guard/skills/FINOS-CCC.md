# FINOS Common Cloud Controls (CCC) Compliance Knowledge

## Framework Overview

The FINOS Common Cloud Controls (CCC) project provides a set of cloud-agnostic security and compliance controls specifically designed for financial services organizations adopting cloud technologies. CCC controls are defined in YAML format and map to common compliance frameworks (PCI-DSS, SOX, NIST, ISO 27001, SOC 2) while being implementable across major cloud providers (AWS, Azure, GCP).

**Applies to:** Financial services institutions using public cloud, private cloud, or hybrid cloud infrastructure.

**CCC Mission:** Reduce duplicative compliance efforts across cloud providers by establishing common control definitions that can be implemented once and validated across multiple frameworks.

**Key differentiators:**
- Cloud-agnostic (not tied to AWS/Azure/GCP-specific services)
- Financial services focused (considers regulatory requirements like SEC, FINRA, FFIEC)
- Community-driven (FINOS open-source governance)
- Machine-readable (YAML format enables automation)

## CCC Control Categories

CCC controls are organized into 8 primary categories aligned with NIST Cybersecurity Framework and ISO 27001:

### 1. Identity and Access Management (IAM)

**Focus:** Authentication, authorization, privileged access management, identity lifecycle.

**Key controls:**
- **CCC-IAM-01:** Multi-factor authentication for privileged access
- **CCC-IAM-02:** Role-based access control (RBAC) with least privilege
- **CCC-IAM-03:** Identity lifecycle management (provisioning, deprovisioning)
- **CCC-IAM-04:** Privileged access monitoring and session recording
- **CCC-IAM-05:** Service account and API key management
- **CCC-IAM-06:** Just-in-time (JIT) access provisioning
- **CCC-IAM-07:** Break-glass emergency access procedures

**CALM Mapping:**
- `access-control` controls on nodes → Map to CCC-IAM-02 (RBAC)
- `multi-factor-authentication` → Map to CCC-IAM-01
- Service node metadata referencing service accounts → Map to CCC-IAM-05
- `privileged-access-management` controls → Map to CCC-IAM-04, CCC-IAM-06

### 2. Data Protection and Privacy

**Focus:** Encryption, data classification, data loss prevention, data residency.

**Key controls:**
- **CCC-DPP-01:** Data at rest encryption using industry-standard algorithms
- **CCC-DPP-02:** Data in transit encryption (TLS 1.2+ or equivalent)
- **CCC-DPP-03:** Cryptographic key management with hardware security modules (HSMs)
- **CCC-DPP-04:** Data classification and labeling (public, internal, confidential, restricted)
- **CCC-DPP-05:** Data loss prevention (DLP) controls
- **CCC-DPP-06:** Data residency and sovereignty controls
- **CCC-DPP-07:** Tokenization and data masking for sensitive data
- **CCC-DPP-08:** Secure data deletion and sanitization

**CALM Mapping:**
- `data-encryption` controls on database nodes → Map to CCC-DPP-01 (at rest)
- `HTTPS`, `TLS`, `mTLS` protocols in `connects` relationships → Map to CCC-DPP-02 (in transit)
- `key-management` controls → Map to CCC-DPP-03
- Database node metadata with data classification → Map to CCC-DPP-04
- `deployed-in` relationships with region/zone metadata → Map to CCC-DPP-06 (data residency)

### 3. Network Security

**Focus:** Network segmentation, firewalls, intrusion detection, secure connectivity.

**Key controls:**
- **CCC-NET-01:** Network segmentation between trust zones
- **CCC-NET-02:** Perimeter firewall and network access controls
- **CCC-NET-03:** Intrusion detection and prevention systems (IDS/IPS)
- **CCC-NET-04:** DDoS protection and mitigation
- **CCC-NET-05:** Secure remote access (VPN, bastion hosts)
- **CCC-NET-06:** Network traffic monitoring and logging
- **CCC-NET-07:** DNS security (DNSSEC, DNS filtering)
- **CCC-NET-08:** API gateway and rate limiting

**CALM Mapping:**
- `network-segmentation` controls on network nodes → Map to CCC-NET-01
- `deployed-in` relationships showing zones/VPCs → Map to CCC-NET-01
- `intrusion-detection` controls → Map to CCC-NET-03
- `rate-limiting` controls on service nodes → Map to CCC-NET-08
- WebSocket, HTTP protocol relationships with rate limits → Map to CCC-NET-08

### 4. Logging and Monitoring

**Focus:** Audit logging, security monitoring, alerting, log retention.

**Key controls:**
- **CCC-LOG-01:** Centralized audit logging for all critical systems
- **CCC-LOG-02:** Log integrity and tamper protection
- **CCC-LOG-03:** Log retention per regulatory requirements (minimum 1 year)
- **CCC-LOG-04:** Real-time security monitoring and alerting
- **CCC-LOG-05:** Time synchronization across all systems (NTP)
- **CCC-LOG-06:** Security information and event management (SIEM) integration
- **CCC-LOG-07:** User activity monitoring and anomaly detection
- **CCC-LOG-08:** Log review and analysis procedures

**CALM Mapping:**
- `audit-logging` controls on nodes → Map to CCC-LOG-01
- `log-retention` controls with specified duration → Map to CCC-LOG-03
- `log-integrity` controls (write-once, SIEM forwarding) → Map to CCC-LOG-02
- `time-sync` controls → Map to CCC-LOG-05
- Service metadata referencing SIEM tools (Splunk, Elastic) → Map to CCC-LOG-06

### 5. Resilience and Availability

**Focus:** Business continuity, disaster recovery, high availability, fault tolerance.

**Key controls:**
- **CCC-RES-01:** High availability architecture (multi-AZ, multi-region)
- **CCC-RES-02:** Automated backup and recovery procedures
- **CCC-RES-03:** Disaster recovery plan with defined RPO/RTO
- **CCC-RES-04:** Fault tolerance and redundancy
- **CCC-RES-05:** Capacity planning and auto-scaling
- **CCC-RES-06:** Service health monitoring and alerting
- **CCC-RES-07:** Incident response and recovery procedures

**CALM Mapping:**
- `backup-recovery` controls on database nodes → Map to CCC-RES-02
- `deployed-in` relationships with multi-zone/region deployment → Map to CCC-RES-01, CCC-RES-04
- Service metadata with auto-scaling configurations → Map to CCC-RES-05
- `incident-response` controls → Map to CCC-RES-07

### 6. Secure Development and Deployment

**Focus:** Secure SDLC, DevSecOps, CI/CD security, infrastructure-as-code.

**Key controls:**
- **CCC-SDD-01:** Secure software development lifecycle (S-SDLC)
- **CCC-SDD-02:** Source code version control and access management
- **CCC-SDD-03:** Static application security testing (SAST)
- **CCC-SDD-04:** Dynamic application security testing (DAST)
- **CCC-SDD-05:** Software composition analysis (SCA) for dependencies
- **CCC-SDD-06:** Container security scanning and hardening
- **CCC-SDD-07:** Infrastructure-as-code (IaC) security scanning
- **CCC-SDD-08:** Secure CI/CD pipeline configuration
- **CCC-SDD-09:** Immutable infrastructure and deployment
- **CCC-SDD-10:** Change management and deployment approvals

**CALM Mapping:**
- Service node metadata referencing SDLC processes → Map to CCC-SDD-01
- `vulnerability-scanning` controls → Map to CCC-SDD-03, CCC-SDD-04, CCC-SDD-05
- `container-security` controls → Map to CCC-SDD-06
- `infrastructure-as-code` controls → Map to CCC-SDD-07
- `change-management` controls → Map to CCC-SDD-10

### 7. Cloud Infrastructure Security

**Focus:** Cloud platform security, resource configuration, misconfigurations, cloud-native controls.

**Key controls:**
- **CCC-CIS-01:** Cloud security posture management (CSPM)
- **CCC-CIS-02:** Secure default configurations (CIS Benchmarks)
- **CCC-CIS-03:** Resource tagging and inventory management
- **CCC-CIS-04:** Cloud account isolation and boundary controls
- **CCC-CIS-05:** Infrastructure drift detection and remediation
- **CCC-CIS-06:** Secrets management (vaults, HSMs, KMS)
- **CCC-CIS-07:** Cloud API security and throttling
- **CCC-CIS-08:** Workload isolation (containers, VMs, functions)

**CALM Mapping:**
- `deployed-in` relationships → Map to CCC-CIS-04 (account/subscription isolation)
- Service node metadata with cloud provider tags → Map to CCC-CIS-03
- `secrets-management` controls → Map to CCC-CIS-06
- `configuration-management` controls → Map to CCC-CIS-02, CCC-CIS-05

### 8. Compliance and Governance

**Focus:** Policy enforcement, compliance automation, audit readiness, risk management.

**Key controls:**
- **CCC-CGO-01:** Security policy definition and communication
- **CCC-CGO-02:** Compliance-as-code automation
- **CCC-CGO-03:** Continuous compliance monitoring
- **CCC-CGO-04:** Risk assessment and risk register
- **CCC-CGO-05:** Third-party risk management (TPRM)
- **CCC-CGO-06:** Audit trail and evidence collection
- **CCC-CGO-07:** Policy exception management
- **CCC-CGO-08:** Security awareness training
- **CCC-CGO-09:** Vulnerability management program
- **CCC-CGO-10:** Penetration testing and red team exercises

**CALM Mapping:**
- `security-policy` controls → Map to CCC-CGO-01
- `risk-management` controls → Map to CCC-CGO-04
- `third-party-management` controls on external system relationships → Map to CCC-CGO-05
- `vulnerability-management` controls → Map to CCC-CGO-09
- `penetration-testing` controls → Map to CCC-CGO-10

## CALM Architecture Mapping

### Node-Level Control Mapping

| CALM Control | CCC Control | Category | Priority |
|--------------|-------------|----------|----------|
| `multi-factor-authentication` | CCC-IAM-01 | IAM | CRITICAL |
| `access-control` | CCC-IAM-02 | IAM | HIGH |
| `data-encryption` | CCC-DPP-01 | Data Protection | CRITICAL |
| `key-management` | CCC-DPP-03 | Data Protection | HIGH |
| `network-segmentation` | CCC-NET-01 | Network Security | HIGH |
| `intrusion-detection` | CCC-NET-03 | Network Security | MEDIUM |
| `audit-logging` | CCC-LOG-01 | Logging | CRITICAL |
| `log-retention` | CCC-LOG-03 | Logging | HIGH |
| `backup-recovery` | CCC-RES-02 | Resilience | HIGH |
| `vulnerability-scanning` | CCC-SDD-03/04/05 | Secure Development | MEDIUM |
| `secrets-management` | CCC-CIS-06 | Cloud Infrastructure | CRITICAL |
| `security-policy` | CCC-CGO-01 | Governance | MEDIUM |

### Relationship-Level Protocol Mapping

| CALM Protocol | CCC Control | Assessment |
|---------------|-------------|------------|
| `HTTPS` / `TLS` / `mTLS` | CCC-DPP-02 | COMPLIANT - Encrypted in-transit communication |
| `HTTP` | CCC-DPP-02 | NON-COMPLIANT - Unencrypted sensitive data transmission |
| `JDBC` (with TLS) | CCC-DPP-02 | COMPLIANT - Database connection encryption |
| `JDBC` (without TLS) | CCC-DPP-02 | NON-COMPLIANT - Unencrypted database traffic |
| `WebSocket Secure (wss://)` | CCC-DPP-02 | COMPLIANT - Encrypted WebSocket |
| `WebSocket (ws://)` | CCC-DPP-02 | NON-COMPLIANT - Unencrypted WebSocket |

### Deployment Topology Mapping

**`deployed-in` relationships reveal cloud deployment patterns:**

- **Multi-zone deployment:** Maps to CCC-RES-01 (high availability), CCC-RES-04 (fault tolerance)
- **Region isolation:** Maps to CCC-DPP-06 (data residency), CCC-CIS-04 (account isolation)
- **Network segmentation:** Maps to CCC-NET-01 (trust zones), CCC-CIS-04 (boundary controls)
- **Container orchestration:** Maps to CCC-CIS-08 (workload isolation)

## Common Findings in Cloud-Native Architectures

### Critical (Immediate Remediation)

1. **Missing encryption in transit for database connections**
   - **Issue:** `JDBC` or `TCP` relationships to database nodes lack TLS/SSL
   - **CCC Control:** CCC-DPP-02 (CRITICAL)
   - **Impact:** Sensitive data exposed over network, regulatory violation
   - **Remediation:** Enable TLS/SSL on all database connections, enforce encrypted protocols

2. **No MFA on privileged cloud access**
   - **Issue:** Service nodes with administrative capabilities lack `multi-factor-authentication`
   - **CCC Control:** CCC-IAM-01 (CRITICAL)
   - **Impact:** Account compromise risk, insider threat exposure
   - **Remediation:** Enforce MFA for all administrative and API access

3. **Missing centralized audit logging**
   - **Issue:** Critical service nodes lack `audit-logging` or logs not forwarded to SIEM
   - **CCC Control:** CCC-LOG-01 (CRITICAL)
   - **Impact:** Cannot detect security incidents, fails compliance audits
   - **Remediation:** Implement centralized logging with SIEM integration (CloudWatch, Stackdriver, Azure Monitor)

4. **Secrets stored in code or environment variables**
   - **Issue:** Service metadata references API keys, database passwords in plain text
   - **CCC Control:** CCC-CIS-06 (CRITICAL)
   - **Impact:** Credential exposure, unauthorized access
   - **Remediation:** Use secrets management service (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault)

### High (Major Compliance Gap)

1. **Single-zone deployment for critical services**
   - **Issue:** `deployed-in` shows single availability zone for database or core service
   - **CCC Control:** CCC-RES-01, CCC-RES-04 (HIGH)
   - **Impact:** Single point of failure, downtime risk
   - **Remediation:** Deploy across multiple availability zones with load balancing

2. **Insufficient network segmentation**
   - **Issue:** All services deployed in single network/VPC without `network-segmentation` controls
   - **CCC Control:** CCC-NET-01 (HIGH)
   - **Impact:** Lateral movement risk, expanded blast radius
   - **Remediation:** Implement network zones (DMZ, application tier, data tier) with firewall rules

3. **No vulnerability scanning in CI/CD**
   - **Issue:** Service nodes lack `vulnerability-scanning` controls for SAST, DAST, SCA
   - **CCC Control:** CCC-SDD-03/04/05 (HIGH)
   - **Impact:** Vulnerabilities deployed to production, exploit risk
   - **Remediation:** Integrate security scanning in CI/CD pipeline (Semgrep, CodeQL, Trivy, Snyk)

4. **Missing backup procedures for stateful services**
   - **Issue:** Database nodes lack `backup-recovery` controls with defined RPO/RTO
   - **CCC Control:** CCC-RES-02, CCC-RES-03 (HIGH)
   - **Impact:** Data loss risk, extended recovery time
   - **Remediation:** Implement automated backups with tested restore procedures

### Medium (Compliance Improvement)

1. **Generic RBAC without least privilege**
   - **Issue:** `access-control` exists but doesn't specify granular role definitions
   - **CCC Control:** CCC-IAM-02 (MEDIUM)
   - **Impact:** Over-privileged accounts, compliance documentation gap
   - **Remediation:** Define fine-grained RBAC roles aligned with business functions

2. **Log retention not documented**
   - **Issue:** `audit-logging` present but no `log-retention` control specifying duration
   - **CCC Control:** CCC-LOG-03 (MEDIUM)
   - **Impact:** May not meet regulatory retention requirements (1+ years)
   - **Remediation:** Document log retention policy (1 year minimum for financial services)

3. **Missing resource tagging**
   - **Issue:** Node metadata doesn't include environment, owner, or cost-center tags
   - **CCC Control:** CCC-CIS-03 (MEDIUM)
   - **Impact:** Poor visibility, difficult compliance scoping
   - **Remediation:** Implement tagging standards (Environment, Owner, DataClassification, CostCenter)

## Assessment Criteria

### Compliant (Score: 90-100)
- All data encrypted in transit (TLS 1.2+) and at rest (AES-256)
- MFA enforced on all privileged access
- Centralized audit logging with SIEM integration and 1+ year retention
- Multi-zone/multi-region deployment for critical services
- Network segmentation with defined trust zones
- Automated backups with tested disaster recovery procedures
- Secrets managed via cloud-native vaults (not environment variables)
- Vulnerability scanning integrated in CI/CD pipeline
- Container/infrastructure security scanning enabled
- Resource tagging and inventory management

### Partial Compliance (Score: 60-89)
- Most but not all connections encrypted
- MFA implemented but with exceptions
- Audit logging exists but not centralized or incomplete
- High availability in some but not all critical services
- Some network segmentation but not comprehensive
- Backup procedures exist but not regularly tested
- Mix of vault-based and environment variable secrets
- Periodic vulnerability scanning but not continuous

### Non-Compliant (Score: 0-59)
- Unencrypted data transmission (HTTP, plain JDBC)
- Missing or inconsistent MFA enforcement
- No centralized audit logging or SIEM
- Single-zone deployment with no redundancy
- Flat network topology (no segmentation)
- No backup procedures or untested disaster recovery
- Secrets in code, environment variables, or config files
- No security scanning in development or deployment

## Cloud Provider Implementation Patterns

While CCC controls are cloud-agnostic, common implementation patterns per provider:

### AWS
- **CCC-IAM-01:** AWS IAM with MFA enforcement policies
- **CCC-DPP-01:** EBS/S3/RDS encryption with KMS keys
- **CCC-LOG-01:** CloudWatch Logs, CloudTrail, VPC Flow Logs → SIEM
- **CCC-NET-01:** VPC with security groups, NACLs, PrivateLink
- **CCC-RES-02:** Automated Backup, AWS Backup, RDS automated backups
- **CCC-CIS-06:** AWS Secrets Manager, Parameter Store

### Azure
- **CCC-IAM-01:** Azure AD Conditional Access with MFA
- **CCC-DPP-01:** Azure Storage encryption, SQL TDE, Disk encryption
- **CCC-LOG-01:** Azure Monitor, Log Analytics, Microsoft Sentinel
- **CCC-NET-01:** VNet with NSGs, Application Security Groups
- **CCC-RES-02:** Azure Backup, Azure Site Recovery
- **CCC-CIS-06:** Azure Key Vault

### GCP
- **CCC-IAM-01:** Google Cloud Identity with 2FA
- **CCC-DPP-01:** Cloud Storage encryption, Cloud SQL encryption
- **CCC-LOG-01:** Cloud Logging, Cloud Monitoring → Chronicle
- **CCC-NET-01:** VPC with firewall rules, Private Google Access
- **CCC-RES-02:** Persistent Disk snapshots, Cloud SQL backups
- **CCC-CIS-06:** Secret Manager

## Key Resources

- **FINOS CCC GitHub:** https://github.com/finos/common-cloud-controls
- **CCC Control Definitions:** YAML files in `services/` directory
- **CCC to Framework Mappings:** Mapping files in `mappings/` directory (PCI-DSS, NIST, SOC 2, ISO 27001)
- **FINOS CCC Documentation:** https://www.finos.org/common-cloud-controls-project

## Notes for LLM Analysis

- **CCC is cloud-agnostic** - Focus on control objectives, not provider-specific implementations
- **Financial services context** - CCC assumes regulatory requirements (SEC, FINRA, FFIEC) apply
- **YAML-first approach** - CCC controls are machine-readable; CALM architectures can reference CCC control IDs directly
- **Mapping to existing frameworks** - CCC provides mappings to PCI-DSS, SOX, NIST, ISO 27001 - leverage these for multi-framework compliance
- **Shared responsibility model** - Cloud provider controls some aspects (physical security, hypervisor), customer controls others (application security, data encryption)
- **Multi-zone = high availability** - Financial services typically require 99.9%+ uptime; single-zone deployments are insufficient
- **Secrets in plain text = critical finding** - Never acceptable in production; always escalate to critical severity
- **Logging must be centralized** - Distributed logs across ephemeral containers are insufficient for incident investigation
