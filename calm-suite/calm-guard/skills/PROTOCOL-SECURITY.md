# Protocol Security — Upgrade Mapping with Regulatory Grounding

## Overview

This skill file grounds protocol upgrade decisions in specific, citable regulatory requirements. When the CALM remediator agent replaces an insecure protocol in a `connects` relationship, the `rationale` field must cite exact control IDs from this table — not invented or approximated references.

**Purpose:** Prevent hallucinated control citations. Every upgrade recommendation must be traceable to a real control ID in the Closed Control ID Reference below.

**Scope:** Only upgrade protocols that appear in the CALM document being analyzed. Do NOT invent connections or flag protocols that are not present.

## Upgrade Mapping Reference

| Insecure Protocol | Secure Replacement | CALM `protocol` Value | PCI-DSS 4.0 Grounding | NIST CSF 2.0 Grounding | SOC2 TSC Grounding |
|-------------------|-------------------|----------------------|----------------------|----------------------|------------------|
| `HTTP` | HTTPS | `HTTPS` | Req 4.2.1 (PAN transmission cryptography) | PR.DS-02 (data-in-transit protection) | CC6.7 (transmission restriction) |
| `FTP` | SFTP | `SFTP` | Req 4.2.1, Req 2.2.7 (non-console admin access encrypted) | PR.DS-02 (data-in-transit protection) | CC6.7 (transmission restriction) |
| `LDAP` | LDAP over TLS | `TLS` | Req 2.2.7 (non-console admin access encrypted) | PR.AA-03 (users/services authenticated), PR.DS-02 (data-in-transit) | CC6.1 (logical access security), CC6.6 (external threat protection) |
| `TCP` | TLS | `TLS` | Req 4.2.1 (PAN transmission cryptography) | PR.DS-02 (data-in-transit protection) | CC6.7 (transmission restriction) |
| `WebSocket` | WebSocket over TLS (WSS) | `TLS` | Req 4.2.1 (PAN transmission cryptography) | PR.DS-02 (data-in-transit protection) | CC6.7 (transmission restriction) |
| `AMQP` | AMQP over TLS | `TLS` | Req 4.2.1 (PAN transmission cryptography) | PR.DS-02 (data-in-transit protection) | CC6.7 (transmission restriction) |

**Note on LDAP:** CALM does not have an `LDAPS` enum value. Use `TLS` as the CALM protocol and note "LDAP over TLS (port 636)" in the remediation description.

**Already compliant protocols (no upgrade needed):** `HTTPS`, `TLS`, `mTLS`, `SFTP`, `JDBC` (verify SSL), `SocketIO` (verify WSS transport)

## Rationale Citation Template

Use this template for the remediator agent's `rationale` field. Fill in bracketed values from the upgrade table above.

```
Upgraded [INSECURE_PROTOCOL] to [SECURE_REPLACEMENT] per PCI-DSS 4.0 [REQ_ID] ([req_description]) and NIST CSF 2.0 [SUBCATEGORY_ID] ([subcategory_description]). Unencrypted [INSECURE_PROTOCOL] transmits data in plaintext and fails both controls. SOC2 TSC [TSC_ID] additionally requires transmission restriction for service organizations.
```

### Filled Examples

**HTTP → HTTPS:**
> Upgraded HTTP to HTTPS per PCI-DSS 4.0 Req 4.2.1 (PAN protected with strong cryptography during transmission) and NIST CSF 2.0 PR.DS-02 (data-in-transit confidentiality, integrity, availability protected). Unencrypted HTTP transmits data in plaintext and fails both controls. SOC2 TSC CC6.7 additionally requires transmission restriction for service organizations.

**FTP → SFTP:**
> Upgraded FTP to SFTP per PCI-DSS 4.0 Req 4.2.1 (PAN protected with strong cryptography during transmission) and Req 2.2.7 (non-console administrative access encrypted) and NIST CSF 2.0 PR.DS-02 (data-in-transit confidentiality, integrity, availability protected). Unencrypted FTP transmits credentials and data in plaintext and fails both controls. SOC2 TSC CC6.7 additionally requires transmission restriction for service organizations.

**LDAP → TLS:**
> Upgraded LDAP to LDAP over TLS (port 636) per PCI-DSS 4.0 Req 2.2.7 (non-console administrative access encrypted) and NIST CSF 2.0 PR.AA-03 (users, services, hardware authenticated) and PR.DS-02 (data-in-transit confidentiality, integrity, availability protected). Unencrypted LDAP exposes directory credentials in plaintext. SOC2 TSC CC6.1 and CC6.6 additionally require logical access security and protection against external threats.

## Closed Control ID Reference

> Use ONLY the IDs in this table when citing controls in protocol upgrade rationale. Do not invent or extrapolate IDs beyond this list. CITE EXACTLY AS SHOWN in the "Citation Format" column.

| Control ID | Framework | Full Name | Citation Format |
|------------|-----------|-----------|----------------|
| Req 2.2.7 | PCI-DSS 4.0 | Non-console administrative access encrypted | "PCI-DSS 4.0 Req 2.2.7" |
| Req 4.2.1 | PCI-DSS 4.0 | PAN protected with strong cryptography during transmission | "PCI-DSS 4.0 Req 4.2.1" |
| PR.AA-03 | NIST CSF 2.0 | Users, services, and hardware are authenticated | "NIST CSF 2.0 PR.AA-03" |
| PR.DS-02 | NIST CSF 2.0 | Data-in-transit confidentiality, integrity, availability protected | "NIST CSF 2.0 PR.DS-02" |
| CC6.1 | SOC2 TSC | Logical access security software, infrastructure, architectures | "SOC2 TSC CC6.1" |
| CC6.6 | SOC2 TSC | Logical access security measures protect against external threats | "SOC2 TSC CC6.6" |
| CC6.7 | SOC2 TSC | Transmission, movement, and removal of information restricted | "SOC2 TSC CC6.7" |

## Notes for LLM Analysis

- **Only flag protocols present in the CALM document** — do not invent connections or relationships
- **Check every `connects` relationship** — iterate through all relationships and inspect the `protocol` field
- **mTLS is the gold standard** — if HTTPS or TLS is present, suggest mTLS as an enhancement (not a required fix)
- **JDBC requires context** — JDBC without explicit SSL metadata should be flagged as partial compliance, not full non-compliance
- **SocketIO** uses WebSocket transport — flag as partial if no explicit WSS/TLS transport confirmation
- **AMQP without TLS** is non-compliant for sensitive data flows; check node descriptions for data classification
- **Do not cite IDs outside this file's Closed Control ID Reference** — if you cannot ground a recommendation in a listed control ID, state the concern without citing a control number
