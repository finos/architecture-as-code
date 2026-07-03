# PCI-DSS (Payment Card Industry Data Security Standard) Compliance Knowledge

## Framework Overview

The Payment Card Industry Data Security Standard (PCI-DSS) is an information security standard for organizations that handle credit cards from major card schemes (Visa, Mastercard, American Express, Discover, JCB). PCI-DSS v4.0 (current version as of March 2024) applies to all entities that store, process, or transmit cardholder data (CHD) or sensitive authentication data (SAD).

**Applies to:** Any organization that accepts, processes, stores, or transmits credit card information - merchants, processors, acquirers, issuers, service providers.

**Merchant levels:**
- **Level 1:** Over 6 million transactions annually (requires annual audit by QSA)
- **Level 2:** 1-6 million transactions annually
- **Level 3:** 20,000 to 1 million e-commerce transactions annually
- **Level 4:** Fewer than 20,000 e-commerce transactions or up to 1 million total transactions annually

## 12 Requirements (Organized in 6 Goals)

### Goal 1: Build and Maintain a Secure Network and Systems

#### Requirement 1: Install and maintain network security controls
- **1.1:** Processes and mechanisms for network security controls
- **1.2:** Network security controls (firewalls, routers) between trusted/untrusted networks
- **1.3:** Network access to cardholder data environment (CDE) is restricted
- **1.4:** Network connections between trusted and untrusted networks are controlled
- **1.5:** Risks to CDE from computing devices in untrusted networks are mitigated

**CALM Mapping:**
- `network-segmentation` controls on network nodes
- `deployed-in` relationships showing CDE isolation
- Firewall rules referenced in `controls.network-security`

#### Requirement 2: Apply secure configurations to all system components
- **2.1:** Processes and mechanisms for secure configurations
- **2.2:** System components configured and managed securely
- **2.3:** Wireless environments configured and managed securely

**CALM Mapping:**
- Service node `metadata` documenting hardening standards
- `configuration-management` controls on service nodes
- References to security baselines (CIS Benchmarks, DISA STIGs)

### Goal 2: Protect Account Data

#### Requirement 3: Protect stored account data
- **3.1:** Processes and mechanisms for protecting stored account data
- **3.2:** Storage of account data is kept to minimum
- **3.3:** Sensitive authentication data (SAD) is not stored after authorization (even if encrypted)
- **3.4:** Access to displays of full PAN is restricted
- **3.5:** Primary account number (PAN) is secured wherever stored
- **3.6:** Cryptographic keys used to protect stored account data are secured
- **3.7:** Cryptographic keys prevent or detect unauthorized substitution

**CALM Mapping:**
- `data-encryption` controls on database nodes storing CHD
- `key-management` controls for encryption key lifecycle
- `data-minimization` controls to limit CHD storage
- Database node descriptions must clarify if they store PAN (full or truncated)

#### Requirement 4: Protect cardholder data with strong cryptography during transmission over open, public networks
- **4.1:** Processes and mechanisms for protecting in-transit CHD with cryptography
- **4.2:** PAN is protected with strong cryptography whenever transmitted over open, public networks

**CALM Mapping:**
- `connects` relationships using `HTTPS`, `TLS`, or `mTLS` protocols
- Protocols like `HTTP`, `FTP`, `Telnet` are **NON-COMPLIANT** for CHD transmission
- `protocol-version` metadata should document TLS 1.2+ (TLS 1.0/1.1 deprecated)

### Goal 3: Maintain a Vulnerability Management Program

#### Requirement 5: Protect all systems and networks from malicious software
- **5.1:** Processes and mechanisms for protecting systems from malware
- **5.2:** Malicious software is prevented or detected and addressed
- **5.3:** Anti-malware mechanisms and processes are active and maintained
- **5.4:** Anti-malware mechanisms cannot be disabled or altered

**CALM Mapping:**
- `malware-protection` controls on service/system nodes
- References to anti-malware solutions (EDR, antivirus)

#### Requirement 6: Develop and maintain secure systems and software
- **6.1:** Processes and mechanisms for secure software development
- **6.2:** Bespoke and custom software are developed securely
- **6.3:** Security vulnerabilities are identified and addressed
- **6.4:** Public-facing web applications protected against attacks
- **6.5:** Changes to system components in production are managed securely

**CALM Mapping:**
- `secure-sdlc` controls referencing OWASP SAMM, NIST SSDF
- `web-application-firewall` (WAF) controls on public-facing web services
- `vulnerability-scanning` controls with scan frequency (quarterly minimum)
- `penetration-testing` controls (annually and after significant changes)

### Goal 4: Implement Strong Access Control Measures

#### Requirement 7: Restrict access to system components and cardholder data by business need to know
- **7.1:** Processes and mechanisms for restricting access
- **7.2:** Access to system components and data is appropriately defined and assigned
- **7.3:** Access to system components and data is managed via access control system

**CALM Mapping:**
- `access-control` controls with RBAC or ABAC definitions
- Principle of least privilege documented in control descriptions
- `need-to-know` basis for CHD access

#### Requirement 8: Identify users and authenticate access to system components
- **8.1:** Processes and mechanisms for identifying and authenticating users
- **8.2:** User identification and related accounts are managed
- **8.3:** Strong authentication is established and managed
- **8.4:** Multi-factor authentication (MFA) is implemented
- **8.5:** MFA systems are configured to prevent misuse
- **8.6:** Use of application and system accounts and associated authentication factors is managed

**CALM Mapping:**
- `multi-factor-authentication` controls on nodes processing CHD
- `password-policy` controls with complexity/rotation requirements
- `authentication` controls specifying MFA for all access to CDE (Req 8.4.2)

#### Requirement 9: Restrict physical access to cardholder data
- **9.1:** Processes and mechanisms for restricting physical access
- **9.2:** Physical access controls manage entry into facilities and systems
- **9.3:** Physical access for personnel and visitors is authorized and managed
- **9.4:** Media with cardholder data is securely stored, accessed, distributed, and destroyed
- **9.5:** Point of Interaction (POI) devices are protected from tampering and unauthorized substitution

**CALM Mapping:**
- `physical-security` controls on `deployed-in` container nodes (data centers, server rooms)
- `media-protection` controls on nodes storing CHD backups
- Less relevant for cloud-native architectures (shared responsibility model)

### Goal 5: Regularly Monitor and Test Networks

#### Requirement 10: Log and monitor all access to system components and cardholder data
- **10.1:** Processes and mechanisms for logging and monitoring
- **10.2:** Audit logs are implemented to support detection of anomalies and suspicious activity
- **10.3:** Audit logs are protected from destruction and unauthorized modification
- **10.4:** Audit logs are reviewed to identify anomalies or suspicious activity
- **10.5:** Audit log history is retained and available for analysis
- **10.6:** Time-synchronization mechanisms support consistent time settings across all systems
- **10.7:** Failures of critical security control systems are detected, alerted, and addressed

**CALM Mapping:**
- `audit-logging` controls on ALL nodes in CDE (critical requirement)
- `log-retention` controls specifying 1-year online + 3-month immediate access (Req 10.5.1)
- `log-integrity` controls preventing tampering (write-once media, SIEM forwarding)
- `time-sync` controls using NTP to ensure accurate timestamps

#### Requirement 11: Test security of systems and networks regularly
- **11.1:** Processes and mechanisms for testing security
- **11.2:** Wireless access points are identified and monitored
- **11.3:** Vulnerabilities are identified through security testing
- **11.4:** External and internal penetration testing is performed
- **11.5:** Network intrusions and unexpected file changes are detected
- **11.6:** Unauthorized changes on payment pages are detected and reported

**CALM Mapping:**
- `vulnerability-scanning` controls with quarterly scan requirement (Req 11.3.1)
- `penetration-testing` controls with annual requirement (Req 11.4.1)
- `intrusion-detection` controls on network nodes (IDS/IPS)
- `file-integrity-monitoring` (FIM) controls on critical system files

### Goal 6: Maintain an Information Security Policy

#### Requirement 12: Support information security with organizational policies and programs
- **12.1:** Processes and mechanisms for supporting information security
- **12.2:** Acceptable use policies are established and implemented
- **12.3:** Risks are formally identified, evaluated, and managed
- **12.4:** PCI-DSS compliance is managed
- **12.5:** PCI-DSS scope is documented and validated
- **12.6:** Security awareness education is ongoing
- **12.7:** Personnel are screened to reduce risks from insider threats
- **12.8:** Third-party service providers (TPSPs) are managed
- **12.9:** Third-party service providers support customers' PCI-DSS compliance
- **12.10:** Suspected and confirmed security incidents are responded to immediately

**CALM Mapping:**
- `security-policy` controls referencing organizational InfoSec policies
- `risk-management` controls with risk assessment procedures
- `incident-response` controls with IR playbooks
- `third-party-management` controls for external service relationships (payment gateways, processors)

## CALM Architecture Mapping

### Node-Level Controls

| CALM Control | PCI-DSS Requirement | Mapping Guidance |
|--------------|---------------------|------------------|
| `data-encryption` | Req 3.5, 3.6, 4.2 | CRITICAL - CHD must be encrypted using strong cryptography (AES-256, RSA 2048+). Check for key management procedures. |
| `access-control` | Req 7.2, 7.3 | Required for all CDE components. Verify RBAC with least privilege and business need-to-know. |
| `multi-factor-authentication` | Req 8.4 | CRITICAL - MFA required for all access to CDE (console, remote, administrative). Non-negotiable in v4.0. |
| `audit-logging` | Req 10.2, 10.3 | CRITICAL - Must log all access to CHD and all privileged actions. Logs must be tamper-proof. |
| `vulnerability-scanning` | Req 11.3.1 | Required quarterly for external-facing systems, after significant changes. ASV scans for public-facing. |
| `penetration-testing` | Req 11.4 | Required annually and after significant infrastructure/application changes. |
| `network-segmentation` | Req 1.2, 1.3 | Isolate CDE from other networks. Reduces PCI scope if properly implemented. |
| `intrusion-detection` | Req 11.5 | IDS/IPS required at perimeter of CDE and at critical points within CDE. |

### Relationship-Level Controls

| CALM Protocol | PCI-DSS Requirement | Assessment |
|---------------|---------------------|------------|
| `HTTPS` | Req 4.2 | COMPLIANT - Secure protocol for CHD transmission over public networks |
| `TLS` / `mTLS` | Req 4.2 | COMPLIANT - TLS 1.2+ required; TLS 1.0/1.1 prohibited |
| `HTTP` | Req 4.2 | CRITICAL NON-COMPLIANCE - NEVER transmit CHD over unencrypted HTTP |
| `FTP` / `Telnet` | Req 2.2, 4.2 | CRITICAL NON-COMPLIANCE - Insecure protocols, must be disabled/replaced |
| `SFTP` / `FTPS` | Req 4.2 | COMPLIANT - Encrypted file transfer acceptable |
| `WebSocket` | Req 4.2 | PARTIAL - Must use WSS (WebSocket Secure) over TLS 1.2+ |
| `JDBC` | Req 4.2 | PARTIAL - Verify database connection encryption (SSL/TLS) |

### Protocol Version Requirements

**TLS Version Compliance (as of PCI-DSS v4.0):**
- **TLS 1.2:** Allowed (minimum acceptable)
- **TLS 1.3:** Recommended (best practice)
- **TLS 1.0/1.1:** Prohibited (deprecated June 2018, prohibited March 2024)
- **SSLv2/v3:** Prohibited (critical vulnerabilities)

## Common Findings in Payment Processing Architectures

### Critical (Immediate Remediation Required)

1. **Unencrypted CHD transmission**
   - **Issue:** HTTP protocol used for payment form submission or API calls transmitting PAN
   - **PCI-DSS Req:** 4.2 (CRITICAL FAILURE)
   - **Impact:** Compliance failure, potential card brand fines, incident response costs
   - **Remediation:** Enforce HTTPS/TLS 1.2+ for ALL CHD transmission

2. **Missing MFA on CDE access**
   - **Issue:** Service nodes in CDE lack `multi-factor-authentication` control
   - **PCI-DSS Req:** 8.4 (CRITICAL FAILURE in v4.0)
   - **Impact:** Unauthorized access to cardholder data environment
   - **Remediation:** Implement MFA for all administrative and remote access to CDE

3. **No audit logging on payment database**
   - **Issue:** Database node storing PAN lacks `audit-logging` control
   - **PCI-DSS Req:** 10.2 (CRITICAL FAILURE)
   - **Impact:** Cannot detect unauthorized access or data exfiltration
   - **Remediation:** Enable comprehensive audit logging with tamper-proof storage (SIEM)

4. **Storing sensitive authentication data after authorization**
   - **Issue:** Database stores CVV2, PIN, or full magnetic stripe data
   - **PCI-DSS Req:** 3.3 (CRITICAL FAILURE)
   - **Impact:** Automatic compliance failure, severe card brand penalties
   - **Remediation:** Purge SAD immediately after authorization; NEVER store CVV2/PIN

### High (Major Compliance Gap)

1. **Weak encryption algorithms**
   - **Issue:** `data-encryption` control references DES, 3DES, or RSA 1024
   - **PCI-DSS Req:** 3.5.1, 3.6.1 (HIGH)
   - **Impact:** Encryption considered weak, may not meet strong cryptography standard
   - **Remediation:** Use AES-256, RSA 2048+ or ECC equivalent

2. **Insufficient network segmentation**
   - **Issue:** CDE not clearly isolated from corporate network via `deployed-in` relationships
   - **PCI-DSS Req:** 1.2.1, 1.3 (HIGH)
   - **Impact:** Expanded PCI scope, increased attack surface
   - **Remediation:** Implement network segmentation with firewall controls, document trust boundaries

3. **Missing vulnerability scanning**
   - **Issue:** Public-facing service nodes lack `vulnerability-scanning` control
   - **PCI-DSS Req:** 11.3.1 (HIGH)
   - **Impact:** Unknown vulnerabilities may exist in CDE
   - **Remediation:** Implement quarterly ASV scans for external systems, internal scans for CDE

4. **No WAF on public-facing web application**
   - **Issue:** Web service node processing CHD lacks `web-application-firewall` control
   - **PCI-DSS Req:** 6.4.2 (HIGH)
   - **Impact:** Vulnerable to OWASP Top 10 attacks (SQLi, XSS, etc.)
   - **Remediation:** Deploy WAF or implement application-layer security controls

### Medium (Compliance Improvement Needed)

1. **Generic access controls without RBAC**
   - **Issue:** `access-control` control exists but doesn't specify role-based access
   - **PCI-DSS Req:** 7.2 (MEDIUM)
   - **Impact:** May not meet least privilege requirement
   - **Remediation:** Document RBAC model with role definitions and access matrices

2. **Log retention not specified**
   - **Issue:** `audit-logging` exists but no `log-retention` control defining retention period
   - **PCI-DSS Req:** 10.5.1 (MEDIUM)
   - **Impact:** May not meet 1-year retention + 3-month immediate access requirement
   - **Remediation:** Add log retention control specifying 1 year online, 3 months immediate

3. **Missing time synchronization**
   - **Issue:** No `time-sync` controls on nodes generating audit logs
   - **PCI-DSS Req:** 10.6 (MEDIUM)
   - **Impact:** Log correlation difficult, forensic analysis compromised
   - **Remediation:** Add NTP time sync controls on all CDE systems

## Assessment Criteria

### Compliant (Score: 90-100)
- All CHD transmitted over encrypted protocols (HTTPS, TLS 1.2+, mTLS)
- MFA enforced on all CDE access points
- Comprehensive audit logging on all CDE components with 1-year retention
- Strong encryption (AES-256) for CHD at rest with documented key management
- Network segmentation clearly defined with firewall controls
- Quarterly vulnerability scanning and annual penetration testing
- No sensitive authentication data (SAD) stored post-authorization
- WAF or equivalent protection on public-facing web applications
- Intrusion detection/prevention systems deployed

### Partial Compliance (Score: 60-89)
- Most but not all CHD transmissions encrypted
- MFA implemented but with exceptions (e.g., console access)
- Audit logging exists but may not cover all required events
- Encryption present but using deprecated algorithms (3DES)
- Network segmentation exists but boundaries not clearly defined
- Vulnerability scanning irregular or not quarterly
- Some access controls present but not full RBAC with least privilege

### Non-Compliant (Score: 0-59)
- Unencrypted CHD transmission (HTTP, FTP, Telnet)
- Missing MFA on CDE access
- Missing or insufficient audit logging
- No encryption of stored CHD or weak encryption (DES)
- Sensitive authentication data (CVV2, PIN) stored post-authorization
- No network segmentation between CDE and corporate network
- No vulnerability scanning or penetration testing
- Public-facing web applications without WAF or security controls

## Scoping Guidance

**Cardholder Data Environment (CDE):** System components that store, process, or transmit CHD, or any system connected to them.

When analyzing CALM architectures:
1. **Identify CHD flows:** Trace all `connects` relationships transmitting payment card data
2. **Mark in-scope nodes:** All nodes that touch CHD are in scope
3. **Connected systems:** Nodes connected to in-scope nodes are also in scope (unless segmented)
4. **Out-of-scope:** Systems with proper segmentation controls can be scoped out

## Key Regulations Referenced

- **PCI-DSS v4.0:** https://www.pcisecuritystandards.org/document_library/ (March 2022, effective March 2024)
- **PA-DSS:** Payment Application Data Security Standard (deprecated, replaced by SSF)
- **PCI Software Security Framework (SSF):** For payment software vendors
- **Card Brand Compliance Programs:** Visa CISP, Mastercard SDP, Amex DSOP, Discover DISC

## Notes for LLM Analysis

- **PCI-DSS v4.0 introduced strict MFA requirements** - Req 8.4 is now CRITICAL; all CDE access requires MFA (no exceptions)
- **TLS version matters** - TLS 1.0/1.1 prohibited; flag any metadata showing old TLS versions
- **Sensitive Authentication Data (SAD) is NEVER allowed post-auth** - Automatic failure if CVV2, PIN, or full track data stored
- **Network segmentation reduces scope** - Properly segmented systems can be excluded from PCI assessment
- **ASV scans required for external systems** - Public-facing CDE components must use Approved Scanning Vendor
- **Risk-based approach in v4.0** - Some requirements offer flexibility (targeted risk analysis), but core requirements (encryption, MFA, logging) are absolute
- **Card brand fines are severe** - Non-compliance can result in $5,000-$100,000/month fines plus incident costs

## Closed Control ID Reference

> Use ONLY the IDs in this table when citing PCI-DSS controls. Do not invent or extrapolate IDs beyond this list. CITE EXACTLY AS SHOWN in the "Citation Format" column.

| Control ID | Full Name | CALM Field | Citation Format |
|------------|-----------|------------|----------------|
| Req 1.2.1 | Define and understand inbound/outbound traffic rules | node.controls.network-segmentation | "PCI-DSS 4.0 Req 1.2.1" |
| Req 1.3 | Network access to CDE restricted | deployed-in relationships | "PCI-DSS 4.0 Req 1.3" |
| Req 2.2.7 | Non-console administrative access encrypted | connects[].protocol | "PCI-DSS 4.0 Req 2.2.7" |
| Req 3.5.1 | PAN rendered unreadable everywhere stored | node.controls.data-encryption | "PCI-DSS 4.0 Req 3.5.1" |
| Req 4.2.1 | PAN protected with strong cryptography during transmission | connects[].protocol | "PCI-DSS 4.0 Req 4.2.1" |
| Req 4.2.1.1 | Inventory of trusted keys/certificates for PAN transmission | node.controls | "PCI-DSS 4.0 Req 4.2.1.1" |
| Req 4.2.1.2 | Wireless networks transmitting PAN use strong cryptography | connects[].protocol | "PCI-DSS 4.0 Req 4.2.1.2" |
| Req 6.2.4 | Software engineering techniques prevent vulnerabilities | node.controls.vulnerability-scanning | "PCI-DSS 4.0 Req 6.2.4" |
| Req 6.4.2 | Public-facing web applications protected against attacks | node.controls.web-application-firewall | "PCI-DSS 4.0 Req 6.4.2" |
| Req 7.2 | Access to system components restricted per least privilege | node.controls.access-control | "PCI-DSS 4.0 Req 7.2" |
| Req 8.3.1 | All user access authenticated with at least one factor | node.controls.access-control | "PCI-DSS 4.0 Req 8.3.1" |
| Req 8.4.2 | MFA for all access into CDE | node.controls.multi-factor-authentication | "PCI-DSS 4.0 Req 8.4.2" |
| Req 10.2.1 | Audit logs capture specified events | node.controls.audit-logging | "PCI-DSS 4.0 Req 10.2.1" |
| Req 10.2.2 | Audit logs record required details | node.controls.audit-logging | "PCI-DSS 4.0 Req 10.2.2" |
| Req 10.5.1 | Audit log history retained for 12 months | node.controls.log-retention | "PCI-DSS 4.0 Req 10.5.1" |
| Req 11.3.1 | Internal vulnerability scans performed quarterly | node.controls.vulnerability-scanning | "PCI-DSS 4.0 Req 11.3.1" |
| Req 11.4.1 | External penetration testing performed annually | node.controls.penetration-testing | "PCI-DSS 4.0 Req 11.4.1" |
| Req 11.5.1 | Intrusion-detection techniques detect intrusions | node.controls.intrusion-detection | "PCI-DSS 4.0 Req 11.5.1" |
| Req 12.10.1 | Incident response plan established and maintained | node.controls.incident-response | "PCI-DSS 4.0 Req 12.10.1" |
