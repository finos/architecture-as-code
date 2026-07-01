# SOX (Sarbanes-Oxley Act) Compliance Knowledge

## Framework Overview

The Sarbanes-Oxley Act of 2002 (SOX) is a U.S. federal law that mandates specific practices in financial record keeping and reporting for corporations. While SOX doesn't prescribe specific IT controls, Section 404 requires management to assess the effectiveness of internal controls over financial reporting (ICFR), which heavily involves IT systems.

**Applies to:** Publicly traded companies in the U.S. and their subsidiaries, accounting firms that audit public companies.

**Key sections relevant to IT:**
- **Section 302:** Corporate Responsibility for Financial Reports - CEOs and CFOs must certify the accuracy of financial statements
- **Section 404:** Management Assessment of Internal Controls - Requires documentation and testing of internal controls over financial reporting

## IT General Controls (ITGC)

SOX compliance relies on IT General Controls that provide a foundation for application controls used in financial reporting systems. ITGCs are typically organized into five categories:

### 1. Access Controls
- **User authentication and authorization:** Multi-factor authentication for systems processing financial data
- **Privileged access management:** Separation of duties for database administrators, system administrators
- **Access reviews:** Periodic review of user access rights (quarterly or semi-annual)
- **Termination procedures:** Immediate revocation of access when employees leave

### 2. Change Management
- **Change request and approval:** Documented approval process for production changes
- **Testing requirements:** Evidence of testing in non-production environments
- **Deployment controls:** Separation between development, testing, and production environments
- **Emergency change procedures:** Documented process for urgent fixes with post-implementation review

### 3. Operations
- **Backup and recovery:** Regular backups of financial systems with tested restore procedures
- **Job scheduling and monitoring:** Automated batch processing with error detection
- **Incident management:** Tracking and resolution of production issues
- **Capacity planning:** Ensuring systems can handle transaction volumes

### 4. Software Development
- **SDLC governance:** Formal development lifecycle with stage gates
- **Code review:** Peer review or automated analysis of code changes
- **Version control:** Source code management with audit trail
- **Release management:** Controlled promotion of code to production

### 5. Data Management
- **Data integrity:** Controls to ensure accuracy and completeness of financial data
- **Data retention:** Maintaining records per retention policies (typically 7 years for financial records)
- **Data encryption:** Protection of sensitive financial data in transit and at rest
- **Data classification:** Identifying and labeling financial data

## CALM Architecture Mapping

### Node-Level Controls

| CALM Control | SOX ITGC Category | Mapping Guidance |
|--------------|-------------------|------------------|
| `access-control` | Access Controls | Maps to user authentication requirements. Look for MFA, RBAC, least privilege principles. |
| `audit-logging` | All categories | Critical for SOX - all financial system activities must be logged. Check for tamper-proof logs, retention policies. |
| `data-encryption` | Data Management | Required for protecting financial data. Verify encryption at rest (AES-256) and in transit (TLS 1.2+). |
| `data-retention` | Data Management | Must align with 7-year retention requirement for financial records per SEC Rule 17a-4. |
| `backup-recovery` | Operations | Required for business continuity. Verify backup frequency, retention, and tested restore procedures. |
| `session-management` | Access Controls | Prevents unauthorized access to financial systems. Check for session timeout, secure cookies. |

### Relationship-Level Controls

| CALM Protocol | SOX Requirement | Assessment |
|---------------|-----------------|------------|
| `HTTPS` / `TLS` / `mTLS` | Data encryption in transit | COMPLIANT - Secure communication protocol |
| `HTTP` | Data encryption in transit | NON-COMPLIANT - Financial data must be encrypted |
| `JDBC` | Database access controls | PARTIAL - Verify connection uses TLS/SSL and authentication |
| `WebSocket` | Secure communication | PARTIAL - Check if WebSocket Secure (wss://) is used |

### Deployment Controls

- **`deployed-in` relationships:** Financial services must be deployed in controlled, segregated networks
- **Network segmentation:** Separate financial systems from general corporate networks (defense-in-depth)
- **Change control:** All deployments to production must follow change management procedures

## Common Findings in Financial Services Architectures

### Critical (Non-Compliant)

1. **Missing audit logging on financial transactions**
   - **Issue:** Database or service nodes processing financial data lack `audit-logging` control
   - **Impact:** Cannot prove accuracy of financial reporting, fails Section 404
   - **Remediation:** Add comprehensive audit logging with immutable log storage (WORM compliance)

2. **Unencrypted database connections**
   - **Issue:** `JDBC` or `TCP` protocols used without TLS/SSL for database containing financial data
   - **Impact:** Financial data exposed in transit, fails data protection requirements
   - **Remediation:** Enable TLS/SSL on database connections, use encrypted protocols

3. **No separation of duties in deployment**
   - **Issue:** Same individuals can develop, test, and deploy to production
   - **Impact:** Risk of unauthorized or untested changes to financial systems
   - **Remediation:** Implement RBAC with separate roles for dev/test/prod access

4. **Inadequate access controls on financial databases**
   - **Issue:** Database nodes lack `access-control` definitions or use shared credentials
   - **Impact:** Cannot trace who accessed/modified financial data
   - **Remediation:** Implement individual user accounts, MFA, periodic access reviews

### High (Partial Compliance)

1. **Insufficient data retention controls**
   - **Issue:** `data-retention` control exists but doesn't specify 7-year retention for financial records
   - **Impact:** May not meet SEC Rule 17a-4 requirements
   - **Remediation:** Document retention policy aligned with regulatory requirements

2. **Backup procedures not documented**
   - **Issue:** `backup-recovery` control lacks specific RPO/RTO metrics
   - **Impact:** Cannot prove ability to recover financial data in disaster scenarios
   - **Remediation:** Document backup schedules, test restore procedures quarterly

3. **Generic session management**
   - **Issue:** `session-management` control exists but doesn't specify timeout duration
   - **Impact:** Risk of session hijacking or unauthorized access
   - **Remediation:** Implement 15-minute idle timeout for financial applications

### Medium (Compliance Gaps)

1. **Missing change management controls**
   - **Issue:** Service nodes lack documented change control procedures
   - **Impact:** Cannot prove changes were tested and approved
   - **Remediation:** Reference change management policy in service metadata

2. **Insufficient network segmentation documentation**
   - **Issue:** `deployed-in` relationships don't clearly show isolation of financial systems
   - **Impact:** Harder to prove defense-in-depth security posture
   - **Remediation:** Add `network-segmentation` controls and document trust boundaries

## Assessment Criteria

### Compliant (Score: 90-100)
- All financial data nodes have `audit-logging`, `data-encryption`, `access-control`
- All database relationships use encrypted protocols (`TLS`, `mTLS`)
- `data-retention` policies documented and aligned with 7-year requirement
- `backup-recovery` procedures documented with tested restore evidence
- Network segmentation clearly defined with `deployed-in` relationships
- Change management controls documented in service metadata

### Partial Compliance (Score: 60-89)
- Audit logging exists but may be incomplete (e.g., doesn't cover all CRUD operations)
- Some but not all database connections are encrypted
- Data retention policies exist but duration unclear
- Backup procedures exist but not regularly tested
- Access controls exist but lack separation of duties or MFA requirements

### Non-Compliant (Score: 0-59)
- Missing audit logging on financial transaction systems
- Unencrypted data in transit or at rest
- No documented access control procedures
- No backup/recovery controls
- No evidence of change management

## Mapping Process

When analyzing a CALM architecture for SOX compliance:

1. **Identify financial data flows:** Trace nodes and relationships that process, store, or transmit financial data
2. **Check ITGCs per category:** Verify each of the 5 ITGC categories (Access, Change, Operations, Development, Data) has corresponding CALM controls
3. **Assess control adequacy:** Review control descriptions and requirements to ensure they meet SOX standards
4. **Document gaps:** List missing or insufficient controls with specific remediation steps
5. **Calculate risk scores:** Weight critical findings (audit logging, encryption) higher than informational findings

## Evidence for Auditors

CALM controls should reference evidence that auditors can verify:

- **Audit logging:** Log retention policy, SIEM configuration, sample log entries
- **Access controls:** User access review reports, MFA enrollment rates, privilege escalation logs
- **Data encryption:** Encryption key management procedures, TLS/SSL certificate chain
- **Backup/recovery:** Backup success reports, disaster recovery test results
- **Change management:** Change request tickets, deployment approval records

## Key Regulations Referenced

- **SOX Section 302:** 15 U.S.C. § 7241 (Corporate Responsibility for Financial Reports)
- **SOX Section 404:** 15 U.S.C. § 7262 (Management Assessment of Internal Controls)
- **SEC Rule 17a-4:** 17 CFR § 240.17a-4 (Records to be preserved by certain exchange members, brokers and dealers)
- **PCAOB AS 2201:** Auditing Standard for Internal Control Over Financial Reporting
- **COSO Framework:** Committee of Sponsoring Organizations Internal Control - Integrated Framework (commonly used for SOX 404 compliance)

## Notes for LLM Analysis

- **SOX doesn't mandate specific technologies** - Focus on whether controls achieve the intent (e.g., audit trail, segregation of duties)
- **Not all systems are in scope** - Only systems that materially affect financial reporting (general ledger, billing, payroll, etc.)
- **Control design vs. operating effectiveness** - CALM architecture shows control design; operating effectiveness requires runtime evidence
- **Compensating controls** - If direct control is missing, look for compensating controls that achieve the same objective
- **Materiality matters** - Risk findings should consider business impact (e.g., payroll system vs. internal wiki)
