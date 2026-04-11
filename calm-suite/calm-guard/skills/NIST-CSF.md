# NIST Cybersecurity Framework (CSF) 2.0 Compliance Knowledge

## Framework Overview

The NIST Cybersecurity Framework (CSF) 2.0, released in February 2024, is a voluntary framework developed by the National Institute of Standards and Technology to help organizations manage and reduce cybersecurity risk. Unlike prescriptive standards (PCI-DSS, HIPAA), CSF 2.0 is a risk-based, outcome-focused framework that organizations can adapt to their specific needs and risk profile.

**Applies to:** All organizations seeking to improve cybersecurity posture, particularly critical infrastructure sectors (financial services, energy, healthcare, transportation). Widely adopted by U.S. federal agencies and financial institutions.

**CSF 2.0 Key Changes from CSF 1.1:**
- Added **GOVERN** function (now 6 functions instead of 5)
- Expanded focus on supply chain risk management
- Enhanced guidance on organizational context and cybersecurity outcomes
- Better alignment with other frameworks (ISO 27001, NIST SP 800-53, CIS Controls)
- Simplified implementation tiers (now focus on outcomes vs. maturity levels)

**Framework Structure:**
- **6 Functions:** High-level cybersecurity outcomes (Govern, Identify, Protect, Detect, Respond, Recover)
- **Categories:** Groups of outcomes within each function (23 total categories)
- **Subcategories:** Specific outcomes to achieve (106 total subcategories)

## The 6 Functions

### 1. GOVERN (GV) - NEW in CSF 2.0

**Purpose:** Establish and monitor the organization's cybersecurity risk management strategy, expectations, and policy.

**Categories:**

#### GV.OC: Organizational Context
- **GV.OC-01:** The organizational mission is understood and informs cybersecurity risk management
- **GV.OC-02:** Internal and external stakeholders are understood
- **GV.OC-03:** Legal, regulatory, and contractual requirements are understood
- **GV.OC-04:** Critical objectives, capabilities, and services are understood
- **GV.OC-05:** Outcomes and performance of cybersecurity strategy are understood

#### GV.RM: Risk Management Strategy
- **GV.RM-01:** Risk management objectives are established and agreed to by stakeholders
- **GV.RM-02:** Risk appetite and risk tolerance statements are established
- **GV.RM-03:** Cybersecurity risk management activities and outcomes are included in enterprise risk management processes
- **GV.RM-04:** Strategic direction for cybersecurity is established and communicated
- **GV.RM-05:** Lines of communication for cybersecurity risk management are established

#### GV.RR: Roles, Responsibilities, and Authorities
- **GV.RR-01:** Cybersecurity roles and responsibilities are established and communicated
- **GV.RR-02:** Roles and responsibilities for external service providers are established
- **GV.RR-03:** Cybersecurity roles and responsibilities are coordinated with related functions
- **GV.RR-04:** Adequate cybersecurity resources are allocated

#### GV.PO: Policy
- **GV.PO-01:** Cybersecurity policy is established, communicated, and enforced
- **GV.PO-02:** Policy is reviewed and updated

#### GV.OV: Oversight
- **GV.OV-01:** Cybersecurity risk management strategy outcomes are reviewed
- **GV.OV-02:** Cybersecurity supply chain risk management strategy outcomes are reviewed
- **GV.OV-03:** Organizational cybersecurity posture is reviewed

#### GV.SC: Cybersecurity Supply Chain Risk Management
- **GV.SC-01:** Cyber supply chain risk management processes are identified, established, managed, monitored, and improved
- **GV.SC-02:** Suppliers are known and monitored
- **GV.SC-03:** Contracts include cybersecurity requirements
- **GV.SC-04:** Suppliers are routinely assessed

**CALM Mapping:**
- `security-policy` controls → Map to GV.PO-01
- `risk-management` controls → Map to GV.RM-01, GV.RM-02
- `third-party-management` controls → Map to GV.SC-01, GV.SC-02, GV.SC-03
- Node metadata documenting governance processes → Map to GV.OV-01, GV.OV-03

### 2. IDENTIFY (ID)

**Purpose:** Develop organizational understanding to manage cybersecurity risk to systems, people, assets, data, and capabilities.

**Categories:**

#### ID.AM: Asset Management
- **ID.AM-01:** Inventories of hardware managed throughout the asset lifecycle
- **ID.AM-02:** Inventories of software, services, and systems managed throughout the lifecycle
- **ID.AM-03:** Representations of organizational systems, critical services, and connections
- **ID.AM-04:** External service dependencies are documented
- **ID.AM-05:** Resources (hardware, software, data, services, people) are prioritized based on classification and criticality
- **ID.AM-07:** Inventories of data and corresponding metadata are managed
- **ID.AM-08:** Systems, hardware, software, services, and data are managed throughout their lifecycles

#### ID.RA: Risk Assessment
- **ID.RA-01:** Vulnerabilities in assets are identified, validated, and recorded
- **ID.RA-02:** Cyber threat intelligence is received from information sharing forums and sources
- **ID.RA-03:** Threats are identified and documented
- **ID.RA-04:** Potential business impacts and likelihoods are identified
- **ID.RA-05:** Threats, vulnerabilities, likelihoods, and impacts are used to understand risk
- **ID.RA-06:** Risk responses are chosen and implemented
- **ID.RA-07:** Changes and exceptions are managed, assessed, and logged
- **ID.RA-08:** Processes for receiving, analyzing, and responding to vulnerability disclosures are established
- **ID.RA-09:** Completeness and accuracy of asset identification are improved
- **ID.RA-10:** Threats, vulnerabilities, likelihoods, and impacts are periodically reassessed

#### ID.IM: Improvement
- **ID.IM-01:** Improvements are identified from evaluations, audits, tests, and exercises
- **ID.IM-02:** Improvements are identified from security incidents
- **ID.IM-03:** Improvements are identified from non-cybersecurity incidents
- **ID.IM-04:** Incident response plans incorporate lessons learned

**CALM Mapping:**
- CALM architecture itself → Maps to ID.AM-03 (system representations)
- Node `unique-id` inventory → Maps to ID.AM-01, ID.AM-02 (asset inventory)
- `data-asset` node types → Map to ID.AM-07 (data inventory)
- `connects` relationships to external systems → Map to ID.AM-04 (external dependencies)
- `vulnerability-scanning` controls → Map to ID.RA-01 (vulnerability identification)
- `risk-management` controls → Map to ID.RA-05, ID.RA-06 (risk understanding, response)

### 3. PROTECT (PR)

**Purpose:** Implement safeguards to ensure delivery of critical services.

**Categories:**

#### PR.AA: Identity Management, Authentication, and Access Control
- **PR.AA-01:** Identities and credentials are issued, managed, verified, revoked, and audited
- **PR.AA-02:** Identities are proofed and bound to credentials
- **PR.AA-03:** Users, services, and hardware are authenticated
- **PR.AA-04:** Identity assertions are protected, conveyed, and verified
- **PR.AA-05:** Access permissions and authorizations are defined, reviewed, and managed
- **PR.AA-06:** Physical access to assets is managed and protected

#### PR.AT: Awareness and Training
- **PR.AT-01:** Personnel are provided with cybersecurity awareness and training
- **PR.AT-02:** Individuals in specialized roles receive training for their responsibilities

#### PR.DS: Data Security
- **PR.DS-01:** Data at rest is protected
- **PR.DS-02:** Data in transit is protected
- **PR.DS-03:** Systems and assets are formally managed throughout their lifecycles
- **PR.DS-04:** Adequate capacity is maintained to ensure availability
- **PR.DS-05:** Protections against data leaks are implemented
- **PR.DS-10:** The confidentiality, integrity, and availability of data is ensured
- **PR.DS-11:** Data is encrypted, hashed, or tokenized as appropriate

#### PR.PS: Platform Security
- **PR.PS-01:** Configuration management practices are established and applied
- **PR.PS-02:** Software is maintained and updated
- **PR.PS-03:** Hardware is maintained
- **PR.PS-04:** Log records are generated and made available
- **PR.PS-06:** Secure software development practices are integrated

#### PR.IR: Technology Infrastructure Resilience
- **PR.IR-01:** Networks and environments are protected from unauthorized access
- **PR.IR-02:** Cybersecurity is included in human resources practices
- **PR.IR-03:** Mechanisms are implemented to achieve resilience
- **PR.IR-04:** Adequate resource capacity is maintained
- **PR.IR-05:** Continuity of operations is maintained

**CALM Mapping:**
- `access-control`, `multi-factor-authentication` → Map to PR.AA-01, PR.AA-03, PR.AA-05
- `data-encryption` controls → Map to PR.DS-01 (at rest), PR.DS-02 (in transit), PR.DS-11
- `HTTPS`, `TLS`, `mTLS` protocols → Map to PR.DS-02
- `audit-logging` controls → Map to PR.PS-04
- `backup-recovery` controls → Map to PR.IR-03, PR.IR-05
- `configuration-management` controls → Map to PR.PS-01
- `network-segmentation` controls → Map to PR.IR-01

### 4. DETECT (DE)

**Purpose:** Develop and implement activities to identify the occurrence of a cybersecurity event.

**Categories:**

#### DE.CM: Continuous Monitoring
- **DE.CM-01:** Networks and network services are monitored
- **DE.CM-02:** The physical environment is monitored
- **DE.CM-03:** Personnel activity and technology usage are monitored
- **DE.CM-04:** Malicious code is detected
- **DE.CM-05:** Unauthorized mobile code is detected
- **DE.CM-06:** External service provider activities are monitored
- **DE.CM-09:** Computing hardware and software, runtime environments, and their data are monitored

#### DE.AE: Adverse Event Analysis
- **DE.AE-01:** Potentially adverse events are analyzed
- **DE.AE-02:** Potentially adverse events are correlated with each other and other data sources
- **DE.AE-03:** Events are analyzed to understand attack targets and methods
- **DE.AE-04:** The estimated impact and scope of adverse events are understood
- **DE.AE-06:** Information on adverse events is provided to authorized staff and tools
- **DE.AE-07:** Cyber threat intelligence and other contextual information are integrated into event analysis
- **DE.AE-08:** Incidents are declared when adverse events meet the defined incident criteria

**CALM Mapping:**
- `intrusion-detection` controls → Map to DE.CM-01 (network monitoring)
- `malware-protection` controls → Map to DE.CM-04 (malicious code detection)
- `audit-logging` + SIEM → Map to DE.AE-01, DE.AE-02 (event analysis, correlation)
- `incident-response` controls → Map to DE.AE-08 (incident declaration)
- Service metadata referencing security monitoring tools → Map to DE.CM-09

### 5. RESPOND (RS)

**Purpose:** Develop and implement activities to take action regarding a detected cybersecurity incident.

**Categories:**

#### RS.MA: Incident Management
- **RS.MA-01:** The incident response plan is executed
- **RS.MA-02:** Incident reports are triaged and validated
- **RS.MA-03:** Incidents are categorized and prioritized
- **RS.MA-04:** Incidents are escalated or elevated as needed
- **RS.MA-05:** The criteria for initiating incident recovery are met

#### RS.AN: Incident Analysis
- **RS.AN-01:** Notifications are sent to internal and external stakeholders
- **RS.AN-02:** The full extent of an incident is understood
- **RS.AN-03:** Forensic analysis is performed
- **RS.AN-04:** Incidents are categorized
- **RS.AN-06:** Actions from the incident response plan are performed
- **RS.AN-07:** Incident data is analyzed and correlated with other sources
- **RS.AN-08:** Incident outcomes and lessons learned are incorporated

#### RS.CO: Incident Response Reporting and Communication
- **RS.CO-01:** Designated personnel and stakeholders are notified of incidents
- **RS.CO-02:** Events and incidents are reported to authorities
- **RS.CO-03:** Information is shared with designated stakeholders

#### RS.MI: Incident Mitigation
- **RS.MI-01:** Incidents are contained
- **RS.MI-02:** Incidents are eradicated
- **RS.MI-03:** Newly identified vulnerabilities are mitigated or documented

**CALM Mapping:**
- `incident-response` controls → Map to RS.MA-01, RS.AN-06
- Service metadata with incident playbooks → Map to RS.MA-02, RS.MA-03
- `forensic-logging` controls → Map to RS.AN-03

### 6. RECOVER (RC)

**Purpose:** Develop and implement activities to maintain plans for resilience and restore capabilities impaired by a cybersecurity incident.

**Categories:**

#### RC.RP: Incident Recovery Plan Execution
- **RC.RP-01:** The recovery plan is executed
- **RC.RP-02:** Recovery activities are coordinated with internal and external parties
- **RC.RP-03:** Recovery actions and lessons learned are communicated

#### RC.CO: Incident Recovery Communication
- **RC.CO-01:** Reputation is repaired after an incident
- **RC.CO-02:** Recovery activities are communicated
- **RC.CO-03:** Public relations are managed
- **RC.CO-04:** Recovery activities and progress are communicated to stakeholders

**CALM Mapping:**
- `disaster-recovery` controls → Map to RC.RP-01
- `backup-recovery` controls → Map to RC.RP-01 (recovery execution)
- Service metadata with RPO/RTO → Map to RC.RP-01

## CALM Architecture Mapping

### Comprehensive Control-to-Subcategory Mapping

| CALM Control | Primary CSF Subcategory | Secondary Subcategories |
|--------------|-------------------------|-------------------------|
| `access-control` | PR.AA-05 | PR.AA-01, PR.AA-03 |
| `multi-factor-authentication` | PR.AA-03 | PR.AA-01 |
| `data-encryption` | PR.DS-01, PR.DS-02 | PR.DS-11 |
| `key-management` | PR.DS-11 | PR.DS-01 |
| `audit-logging` | PR.PS-04 | DE.CM-03, DE.AE-01 |
| `log-retention` | PR.PS-04 | ID.AM-07 |
| `network-segmentation` | PR.IR-01 | ID.AM-03 |
| `intrusion-detection` | DE.CM-01 | DE.AE-01 |
| `malware-protection` | DE.CM-04 | PR.PS-02 |
| `vulnerability-scanning` | ID.RA-01 | PR.PS-02 |
| `penetration-testing` | ID.RA-01 | ID.IM-01 |
| `backup-recovery` | PR.IR-03 | RC.RP-01 |
| `disaster-recovery` | RC.RP-01 | PR.IR-05 |
| `incident-response` | RS.MA-01 | RS.AN-06, DE.AE-08 |
| `change-management` | PR.PS-01 | ID.RA-07 |
| `configuration-management` | PR.PS-01 | PR.PS-03 |
| `security-policy` | GV.PO-01 | GV.PO-02 |
| `risk-management` | GV.RM-01 | ID.RA-05, ID.RA-06 |
| `third-party-management` | GV.SC-02 | GV.SC-03, GV.SC-04 |
| `secrets-management` | PR.AA-01 | PR.DS-11 |
| `web-application-firewall` | PR.IR-01 | DE.CM-01 |

### Protocol-to-Subcategory Mapping

| CALM Protocol | CSF Subcategory | Assessment |
|---------------|-----------------|------------|
| `HTTPS`, `TLS`, `mTLS` | PR.DS-02 | COMPLIANT - Encrypted data in transit |
| `HTTP` | PR.DS-02 | NON-COMPLIANT - Unencrypted sensitive data |
| `SFTP`, `FTPS` | PR.DS-02 | COMPLIANT - Encrypted file transfer |
| `FTP`, `Telnet` | PR.DS-02 | NON-COMPLIANT - Insecure protocols |
| `JDBC` (with SSL) | PR.DS-02 | COMPLIANT - Database encryption |
| `JDBC` (without SSL) | PR.DS-02 | PARTIAL - Depends on network trust |
| `WebSocket Secure (wss://)` | PR.DS-02 | COMPLIANT - Encrypted WebSocket |
| `WebSocket (ws://)` | PR.DS-02 | NON-COMPLIANT - Unencrypted real-time data |

### Node Type Mapping

| CALM Node Type | CSF Context | Key Subcategories |
|----------------|-------------|-------------------|
| `database` | Data storage asset | ID.AM-07, PR.DS-01, PR.DS-11, PR.PS-04 |
| `service` | System component | ID.AM-02, PR.PS-01, PR.PS-04, DE.CM-09 |
| `system` | External dependency | ID.AM-04, GV.SC-02 |
| `network` | Infrastructure | ID.AM-03, PR.IR-01, DE.CM-01 |
| `actor` | Human user | PR.AA-01, PR.AT-01 |
| `webclient` | User interface | PR.AA-03, PR.DS-02 |

## Common Findings in CSF Assessments

### Critical (Governance/Protection Gaps)

1. **No documented cybersecurity policy**
   - **Issue:** Missing `security-policy` controls across architecture
   - **CSF Subcategory:** GV.PO-01 (CRITICAL)
   - **Impact:** No governance foundation, difficult to enforce controls
   - **Remediation:** Establish and document cybersecurity policy, reference in metadata

2. **Unencrypted sensitive data in transit**
   - **Issue:** `HTTP` or `TCP` protocols for sensitive data flows
   - **CSF Subcategory:** PR.DS-02 (CRITICAL)
   - **Impact:** Data exposure, confidentiality violation
   - **Remediation:** Enforce HTTPS/TLS 1.2+ for all sensitive data transmission

3. **Missing audit logging on critical systems**
   - **Issue:** Database or service nodes lack `audit-logging` controls
   - **CSF Subcategory:** PR.PS-04, DE.CM-03 (CRITICAL)
   - **Impact:** Cannot detect unauthorized access or incidents
   - **Remediation:** Implement comprehensive audit logging with SIEM integration

4. **No incident response plan**
   - **Issue:** Architecture lacks `incident-response` controls or references
   - **CSF Subcategory:** RS.MA-01, RS.AN-06 (CRITICAL)
   - **Impact:** Chaotic incident handling, extended recovery time
   - **Remediation:** Develop and document incident response playbooks

### High (Risk Management/Detection Gaps)

1. **No vulnerability management program**
   - **Issue:** Missing `vulnerability-scanning` or `penetration-testing` controls
   - **CSF Subcategory:** ID.RA-01 (HIGH)
   - **Impact:** Unknown vulnerabilities, exploit risk
   - **Remediation:** Implement regular vulnerability scanning and annual penetration testing

2. **Insufficient backup/recovery procedures**
   - **Issue:** Database nodes lack `backup-recovery` controls with RPO/RTO
   - **CSF Subcategory:** PR.IR-03, RC.RP-01 (HIGH)
   - **Impact:** Data loss risk, extended downtime
   - **Remediation:** Implement automated backups with tested restore procedures

3. **No network monitoring or intrusion detection**
   - **Issue:** Network nodes lack `intrusion-detection` controls
   - **CSF Subcategory:** DE.CM-01 (HIGH)
   - **Impact:** Cannot detect network-based attacks
   - **Remediation:** Deploy IDS/IPS at network perimeter and critical points

4. **External dependencies not documented**
   - **Issue:** `system` node types (external services) lack third-party risk controls
   - **CSF Subcategory:** GV.SC-02, ID.AM-04 (HIGH)
   - **Impact:** Supply chain risk, blind spots in security posture
   - **Remediation:** Document all external dependencies, assess supplier security

### Medium (Awareness/Improvement Gaps)

1. **Generic access controls without least privilege**
   - **Issue:** `access-control` exists but doesn't specify RBAC or least privilege
   - **CSF Subcategory:** PR.AA-05 (MEDIUM)
   - **Impact:** Over-privileged accounts, compliance gap
   - **Remediation:** Define role-based access with documented least privilege model

2. **No formal risk assessment process**
   - **Issue:** `risk-management` controls missing or lack structured approach
   - **CSF Subcategory:** GV.RM-01, ID.RA-05 (MEDIUM)
   - **Impact:** Ad-hoc risk decisions, unmitigated risks
   - **Remediation:** Establish formal risk assessment process (annually or per change)

3. **Configuration management not documented**
   - **Issue:** Service nodes lack `configuration-management` controls
   - **CSF Subcategory:** PR.PS-01 (MEDIUM)
   - **Impact:** Configuration drift, security misconfigurations
   - **Remediation:** Implement configuration baselines and drift detection

## Assessment Criteria

### Mature Implementation (Tier 3-4, Score: 85-100)

**GOVERN:**
- Documented cybersecurity policy and risk management strategy
- Clear roles and responsibilities with adequate resources
- Third-party risk management program with supplier assessments

**IDENTIFY:**
- Comprehensive asset inventory (nodes, relationships, flows)
- Regular vulnerability assessments and risk reassessments
- External dependencies documented and monitored

**PROTECT:**
- Strong access controls with MFA for privileged access
- Data encryption at rest and in transit (AES-256, TLS 1.2+)
- Audit logging on all critical systems with 1+ year retention
- Network segmentation and defense-in-depth architecture
- Automated backup and recovery procedures

**DETECT:**
- Continuous monitoring with SIEM and IDS/IPS
- Malware protection on endpoints and servers
- Security event correlation and threat intelligence integration

**RESPOND:**
- Documented incident response plan with playbooks
- Incident triage, categorization, and escalation procedures
- Forensic capabilities and lessons learned processes

**RECOVER:**
- Disaster recovery plan with tested procedures
- Defined RPO/RTO objectives and recovery coordination

### Developing Implementation (Tier 2, Score: 60-84)

- Partial cybersecurity policy, gaps in governance
- Asset inventory exists but may be incomplete
- Some access controls and encryption, but inconsistent
- Audit logging on critical systems, retention may be insufficient
- Some vulnerability scanning, not regular or comprehensive
- Basic incident response procedures, not fully documented
- Backup procedures exist but not regularly tested

### Partial Implementation (Tier 1, Score: 0-59)

- No documented cybersecurity policy or governance
- Incomplete or missing asset inventory
- Weak or missing access controls and encryption
- Insufficient or missing audit logging
- No vulnerability management or penetration testing
- No incident response plan
- No backup procedures or disaster recovery plan

## CSF Implementation Tiers (Simplified)

NIST CSF 2.0 de-emphasized formal tiers but organizations can still assess maturity:

- **Tier 1 - Partial:** Risk management is ad hoc, limited awareness, reactive
- **Tier 2 - Risk Informed:** Risk management approved but not enterprise-wide, some processes defined
- **Tier 3 - Repeatable:** Enterprise-wide risk management, formalized policies, regular updates
- **Tier 4 - Adaptive:** Risk management integrated into culture, continuous improvement, advanced capabilities

## Mapping Process for CALM Architectures

1. **Map GOVERN:** Check for `security-policy`, `risk-management`, `third-party-management` controls
2. **Map IDENTIFY:** Use CALM architecture as ID.AM-03 (system representation), inventory all nodes/relationships
3. **Map PROTECT:** Check node-level controls (access, encryption, logging, backup) and protocols (HTTPS, TLS)
4. **Map DETECT:** Check for `intrusion-detection`, `malware-protection`, `audit-logging` with SIEM
5. **Map RESPOND:** Check for `incident-response` controls and playbooks
6. **Map RECOVER:** Check for `backup-recovery`, `disaster-recovery` controls with RPO/RTO

## Key NIST Resources

- **NIST CSF 2.0:** https://www.nist.gov/cyberframework (February 2024)
- **NIST SP 800-53 Rev 5:** Security and Privacy Controls (detailed technical controls)
- **NIST SP 800-171:** Protecting Controlled Unclassified Information (CUI)
- **NIST Risk Management Framework (RMF):** Comprehensive risk management process
- **CSF Informative References:** Mappings to other frameworks (ISO 27001, CIS Controls, IEC 62443)

## Notes for LLM Analysis

- **CSF is outcome-focused, not prescriptive** - Focus on whether objectives are achieved, not specific tools/technologies
- **All 6 functions should be assessed** - Missing entire functions (e.g., GOVERN, RESPOND) is a critical gap
- **GOVERN is foundational** - Without governance (policy, risk management), other controls lack strategic direction
- **Data protection is dual-pronged** - Both PR.DS-01 (at rest) and PR.DS-02 (in transit) must be addressed
- **Logging bridges Protect and Detect** - Audit logs are both a protective control (PR.PS-04) and detection mechanism (DE.CM-03)
- **Supply chain risk is critical** - Third-party/external system relationships (GV.SC) are increasingly prioritized in CSF 2.0
- **CSF can complement other frameworks** - Use CSF as meta-framework that maps to PCI-DSS, SOX, ISO 27001 for comprehensive coverage
- **Incident response is binary** - Either you have a documented IR plan or you don't; "partial" IR is high risk
- **Backup without testing is insufficient** - RC.RP-01 requires tested recovery, not just backup existence

## Closed Control ID Reference

> Use ONLY the IDs in this table when citing NIST CSF controls. Do not invent or extrapolate IDs beyond this list. CITE EXACTLY AS SHOWN in the "Citation Format" column.

| Control ID | Full Name | CALM Field | Citation Format |
|------------|-----------|------------|----------------|
| GV.OC-01 | Organizational mission understood and informs cybersecurity | node.metadata | "NIST CSF 2.0 GV.OC-01" |
| GV.PO-01 | Cybersecurity policy established and communicated | node.controls.security-policy | "NIST CSF 2.0 GV.PO-01" |
| GV.RM-01 | Risk management objectives established and communicated | node.controls.risk-management | "NIST CSF 2.0 GV.RM-01" |
| GV.SC-02 | Cybersecurity supply chain risk management established | node.controls.third-party-management | "NIST CSF 2.0 GV.SC-02" |
| ID.AM-02 | Software platforms and applications inventoried | node (service, system) | "NIST CSF 2.0 ID.AM-02" |
| ID.AM-03 | Representations of network communication and data flows | connects relationships | "NIST CSF 2.0 ID.AM-03" |
| ID.AM-07 | Inventories of data maintained | node (database) | "NIST CSF 2.0 ID.AM-07" |
| ID.RA-01 | Vulnerabilities identified, validated, recorded | node.controls.vulnerability-scanning | "NIST CSF 2.0 ID.RA-01" |
| PR.AA-01 | Identities and credentials managed | node.controls.secrets-management | "NIST CSF 2.0 PR.AA-01" |
| PR.AA-03 | Users, services, hardware authenticated | node.controls.multi-factor-authentication | "NIST CSF 2.0 PR.AA-03" |
| PR.AA-05 | Access permissions, entitlements, authorizations managed | node.controls.access-control | "NIST CSF 2.0 PR.AA-05" |
| PR.DS-01 | Data-at-rest confidentiality, integrity, availability protected | node.controls.data-encryption | "NIST CSF 2.0 PR.DS-01" |
| PR.DS-02 | Data-in-transit confidentiality, integrity, availability protected | connects[].protocol | "NIST CSF 2.0 PR.DS-02" |
| PR.DS-11 | Data backups maintained, tested, and documented | node.controls.backup-recovery | "NIST CSF 2.0 PR.DS-11" |
| PR.IR-01 | Networks and environments are protected | node.controls.network-segmentation | "NIST CSF 2.0 PR.IR-01" |
| PR.PS-01 | Configuration management practices established | node.controls.configuration-management | "NIST CSF 2.0 PR.PS-01" |
| PR.PS-04 | Log records generated and made available | node.controls.audit-logging | "NIST CSF 2.0 PR.PS-04" |
| DE.CM-01 | Networks monitored for anomalous behavior | node.controls.intrusion-detection | "NIST CSF 2.0 DE.CM-01" |
| DE.CM-04 | Malicious code detected | node.controls.malware-protection | "NIST CSF 2.0 DE.CM-04" |
| RS.MA-01 | Incident response plan executed | node.controls.incident-response | "NIST CSF 2.0 RS.MA-01" |
| RC.RP-01 | Recovery plan executed | node.controls.disaster-recovery | "NIST CSF 2.0 RC.RP-01" |
