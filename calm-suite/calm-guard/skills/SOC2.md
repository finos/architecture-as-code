# SOC2 (System and Organization Controls 2) Compliance Knowledge

## Framework Overview

SOC2 is an auditing standard developed by the AICPA (American Institute of CPAs) for service organizations that store, process, or transmit customer data. Based on the Trust Service Criteria (TSC), published in 2017 and updated 2022.

**Type I vs Type II:**
- **Type I:** Point-in-time assessment — controls are suitably designed as of a specific date
- **Type II:** Period assessment (typically 6–12 months) — controls operate effectively over time
- **Relevance:** Architecture-level CALM analysis maps to Type II control design objectives

**Applies to:** SaaS providers, cloud platforms, data processors, managed service providers — any service organization handling customer data.

## Trust Service Categories

### Common Criteria (CC) — Security (Always Required)

#### CC1 — Control Environment (CC1.1–CC1.5)
Organizational governance, board oversight, ethics, competence, accountability.
- **CALM observable:** security-policy controls, governance metadata — CC1 is primarily organizational, low CALM signal

#### CC2 — Communication (CC2.1–CC2.3)
Internal/external communication of security objectives and responsibilities.
- **CALM observable:** node metadata documenting security ownership — low CALM signal

#### CC3 — Risk Assessment (CC3.1–CC3.4)
Risk identification, fraud risk, change risk assessment processes.
- **CALM observable:** risk-management controls on nodes — moderate CALM signal

#### CC4 — Monitoring (CC4.1–CC4.2)
Ongoing monitoring activities and evaluation of control deficiencies.
- **CALM observable:** intrusion-detection, audit-logging controls — moderate CALM signal

#### CC5 — Control Activities (CC5.1–CC5.3)
Policies, procedures, and technology controls to mitigate risks.
- **CALM observable:** Most controls map here as general — moderate CALM signal

#### CC6 — Logical and Physical Access Controls (CC6.1–CC6.8) — HIGH CALM SIGNAL
| Criterion | Description | CALM Field |
|-----------|-------------|------------|
| CC6.1 | Logical access security software, infrastructure, architectures | node.controls.access-control |
| CC6.2 | New internal and external users registered and authorized | node.controls.access-control |
| CC6.3 | Role-based access and least privilege | node.controls.access-control |
| CC6.4 | Credentials and access revoked upon termination | node.controls.access-control |
| CC6.5 | Logical access restricted using multi-factor authentication | node.controls.multi-factor-authentication |
| CC6.6 | Logical access security measures protect against threats outside system boundaries | node.controls.network-segmentation, deployed-in |
| CC6.7 | Transmission, movement, and removal of information restricted | connects[].protocol (HTTPS, TLS, mTLS) |
| CC6.8 | Logical access security measures include data loss prevention controls | node.controls.data-encryption |

#### CC7 — System Operations (CC7.1–CC7.5) — HIGH CALM SIGNAL
| Criterion | Description | CALM Field |
|-----------|-------------|------------|
| CC7.1 | Infrastructure components monitored to detect anomalies | node.controls.intrusion-detection |
| CC7.2 | Malicious software detected and addressed | node.controls.malware-protection |
| CC7.3 | Security event monitoring and analysis | node.controls.audit-logging (SIEM) |
| CC7.4 | Security incidents identified and reported | node.controls.incident-response |
| CC7.5 | Incidents communicated to affected parties | node.controls.incident-response |

#### CC8 — Change Management (CC8.1)
Changes managed to meet commitments; assessments before/after changes.
- **CALM observable:** configuration-management, change-management controls — low-moderate CALM signal

#### CC9 — Risk Mitigation (CC9.1–CC9.2)
Risk mitigation activities, business disruption management, vendor/partner risk.
- **CALM observable:** third-party-management controls, backup-recovery — moderate CALM signal

### Availability (A) — Optional Category

| Criterion | Description | CALM Field |
|-----------|-------------|------------|
| A1.1 | Current processing capacity and usage monitored | node.controls.backup-recovery, node metadata |
| A1.2 | Environmental threats monitored | node.controls.backup-recovery |
| A1.3 | Recovery plan procedures established and tested | node.controls.backup-recovery, disaster-recovery |

### Confidentiality (C) — Optional Category

| Criterion | Description | CALM Field |
|-----------|-------------|------------|
| C1.1 | Confidential information identified and protected during collection | node.controls.data-encryption |
| C1.2 | Confidential information disposed of at end of retention | node.controls (data-retention) |

### Processing Integrity (PI) — Optional Category

| Criterion | Description | CALM Field |
|-----------|-------------|------------|
| PI1.1 | Processing integrity policies established | node metadata |
| PI1.2 | System inputs validated | node.controls (input-validation) |
| PI1.3 | System processing complete, accurate, timely | node metadata |
| PI1.4 | System outputs validated | node metadata |
| PI1.5 | Stored data complete, accurate, current | node.controls (data-integrity) |

### Privacy (P) — Optional Category (Rarely CALM-Observable)
P1.1–P1.2 cover privacy notice and consent. Organizational in nature; minimal CALM signal.

## CALM Field Mapping Summary

| SOC2 Criterion | CALM Mapping | Control Key |
|----------------|-------------|-------------|
| CC6.1 | `node.controls` | `access-control` |
| CC6.2 | `node.controls` | `access-control` |
| CC6.5 | `node.controls` | `multi-factor-authentication` |
| CC6.6 | `deployed-in` relationships, network nodes | `network-segmentation` |
| CC6.7 | `connects[].protocol` (must be HTTPS, TLS, mTLS) | protocol field |
| CC6.8 | `node.controls` on database/storage | `data-encryption` |
| CC7.1 | `node.controls` on network/system nodes | `intrusion-detection` |
| CC7.2 | `node.controls` on service/system nodes | `malware-protection` |
| CC7.3 | `node.controls` | `audit-logging` |
| CC7.4 | `node.controls` | `incident-response` |
| A1.1 | `node.controls` on service nodes | `backup-recovery` |
| A1.3 | `node.controls` on service/database nodes | `disaster-recovery` |
| C1.1 | `node.controls` on database/data-asset nodes | `data-encryption` |

## Closed Control ID Reference

> Use ONLY the IDs in this table when citing SOC2 controls. Do not invent or extrapolate IDs beyond this list. CITE EXACTLY AS SHOWN in the "Citation Format" column.

| Control ID | Full Name | CALM Field | Citation Format |
|------------|-----------|------------|----------------|
| CC6.1 | Logical access security software, infrastructure, architectures | node.controls.access-control | "SOC2 TSC CC6.1" |
| CC6.2 | New internal and external users registered and authorized | node.controls.access-control | "SOC2 TSC CC6.2" |
| CC6.3 | Role-based access and least privilege | node.controls.access-control | "SOC2 TSC CC6.3" |
| CC6.4 | Credentials and access revoked upon termination | node.controls.access-control | "SOC2 TSC CC6.4" |
| CC6.5 | Logical access restricted using multi-factor authentication | node.controls.multi-factor-authentication | "SOC2 TSC CC6.5" |
| CC6.6 | Logical access security measures protect against external threats | node.controls.network-segmentation | "SOC2 TSC CC6.6" |
| CC6.7 | Transmission, movement, and removal of information restricted | connects[].protocol | "SOC2 TSC CC6.7" |
| CC6.8 | Data loss prevention controls for logical access | node.controls.data-encryption | "SOC2 TSC CC6.8" |
| CC7.1 | Infrastructure components monitored to detect anomalies | node.controls.intrusion-detection | "SOC2 TSC CC7.1" |
| CC7.2 | Malicious software detected and addressed | node.controls.malware-protection | "SOC2 TSC CC7.2" |
| CC7.3 | Security event monitoring and analysis | node.controls.audit-logging | "SOC2 TSC CC7.3" |
| CC7.4 | Security incidents identified and reported | node.controls.incident-response | "SOC2 TSC CC7.4" |
| CC7.5 | Incidents communicated to affected parties | node.controls.incident-response | "SOC2 TSC CC7.5" |
| CC8.1 | Changes managed to meet commitments | node.controls.change-management | "SOC2 TSC CC8.1" |
| CC9.1 | Risk mitigation activities | node.controls.risk-management | "SOC2 TSC CC9.1" |
| CC9.2 | Business disruption and vendor/partner risk | node.controls.third-party-management | "SOC2 TSC CC9.2" |
| A1.1 | Current processing capacity and usage monitored | node.controls.backup-recovery | "SOC2 TSC A1.1" |
| A1.2 | Environmental threats monitored | node.controls.backup-recovery | "SOC2 TSC A1.2" |
| A1.3 | Recovery plan procedures established and tested | node.controls.disaster-recovery | "SOC2 TSC A1.3" |
| C1.1 | Confidential information identified and protected | node.controls.data-encryption | "SOC2 TSC C1.1" |
| C1.2 | Confidential information disposed at end of retention | node.controls (data-retention) | "SOC2 TSC C1.2" |

## Notes for LLM Analysis

- **Focus on CC6 and CC7** — These are the highest CALM-signal criteria. CC6 maps directly to access controls, MFA, and protocol security. CC7 maps to monitoring, malware, and incident response.
- **CC1–CC5 are organizational controls** — Policies, governance, risk programs. CALM architecture files rarely contain enough signal to assess these; note as "not assessable from architecture" rather than flagging as gaps.
- **CC6.7 is the protocol criterion** — Any `connects` relationship using HTTP, FTP, or TCP (unencrypted) fails CC6.7. HTTPS, TLS, mTLS, and SFTP are compliant.
- **Availability category (A) is optional** but commonly required by B2B SaaS customers. Assess if backup-recovery or disaster-recovery controls are present.
- **Confidentiality (C) is optional** but relevant to any architecture handling customer data. data-encryption on database nodes is the primary signal.
- **Do not assess Privacy (P) from architecture** — P criteria are consent/notice based, not architecture-observable.
- **Type II relevance** — CALM can only assess control design (Type I evidence). Note this limitation in findings.
