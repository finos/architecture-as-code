# Day 21: Model Data Lineage

## Overview
Use flows to document how data moves through your system, creating a data lineage map for compliance and debugging.

## Objective and Rationale
- **Objective:** Create comprehensive flows showing data movement from source to destination, including transformations and storage
- **Rationale:** Data lineage is essential for GDPR compliance, data governance, impact analysis, and debugging data quality issues. Flows in CALM map data journeys to technical architecture.

## Requirements

### 1. Understand Data Lineage

Data lineage tracks:
- **Origins:** Where data enters the system
- **Transformations:** How data is modified
- **Storage:** Where data is persisted
- **Consumption:** Who uses the data
- **Retention:** How long data lives

Use CALM flows to model this with:
- Transitions showing data movement
- Summaries describing transformations
- Controls for data handling requirements

### 2. Identify Data Flows in Your System

**File:** `docs/data-lineage-planning.md`

**Content:**
```markdown
# Data Lineage Planning

## System: [Your Production System]

### Data Sources

| Data Type | Source | Format | Sensitivity |
|-----------|--------|--------|-------------|
| Customer data | User registration | JSON | PII |
| Order data | Order placement | JSON | Confidential |
| Payment data | Payment gateway | JSON | PCI-DSS |
| Analytics data | User interactions | Events | Anonymous |

### Data Stores

| Store | Type | Data Types | Retention |
|-------|------|------------|-----------|
| User DB | PostgreSQL | Customers, Auth | Indefinite |
| Order DB | PostgreSQL | Orders, Items | 7 years |
| Analytics DB | ClickHouse | Events | 90 days |
| Cache | Redis | Session, Temp | 24 hours |

### Data Transformations

| From | To | Transformation | Purpose |
|------|-----|----------------|---------|
| Raw events | Analytics | Aggregation | Reporting |
| Order data | Invoice | Formatting | Billing |
| Customer PII | Reports | Anonymization | Privacy |

### Compliance Requirements

- **GDPR:** Right to deletion, data portability
- **PCI-DSS:** Payment data encryption, access controls
- **SOX:** Financial data retention
```

### 3. Create Customer Data Lineage Flow

**Prompt:**
```text
Add a flow to architectures/production-[system-name].json:

unique-id: "customer-data-lineage"
name: "Customer Personal Data Flow"
description: "Complete lineage of customer personal data from collection to deletion"

Transitions (adjust to your architecture):
1. User → Frontend: "Customer enters personal data (name, email, address)"
2. Frontend → API Gateway: "Data submitted via HTTPS"
3. API Gateway → User Service: "Routing to user management service"
4. User Service → User Database: "PII stored with encryption at rest"
5. User Database → Analytics Service: "Anonymized data exported for analytics"
6. Analytics Service → Analytics Database: "Aggregated, non-PII metrics stored"

Add controls to this flow:
- "data-privacy" control
  - description: "GDPR compliance for personal data handling"
  - requirements:
    - control-requirement-url: "https://gdpr.eu/article-5-how-to-process-personal-data/"
    - control-requirement-url: "https://gdpr.eu/right-to-be-forgotten/"
```

### 4. Create Payment Data Lineage Flow

**Prompt:**
```text
Add a payment data lineage flow to architectures/production-[system-name].json:

unique-id: "payment-data-lineage"
name: "Payment Data Flow"
description: "Lineage of payment information from collection to processing"

Transitions:
1. Customer → Frontend: "Payment details entered"
2. Frontend → API Gateway: "Tokenized payment data transmitted"
3. API Gateway → Payment Service: "Payment processing request"
4. Payment Service → External Payment Gateway: "PCI-compliant payment processing"
5. External Payment Gateway → Payment Service (destination-to-source): "Payment confirmation received"
6. Payment Service → Payment Database: "Transaction record stored (no card details)"
7. Payment Database → Reporting Service: "Financial data for reconciliation"

Add controls:
- "pci-dss-compliance" control
  - description: "Payment Card Industry Data Security Standard compliance"
  - requirements:
    - control-requirement-url: "https://www.pcisecuritystandards.org/documents/PCI-DSS-v4.0"
    - control-config-url: "https://github.com/org/compliance/pci-dss-config.json"
```

### 5. Create Analytics Data Lineage Flow

**Prompt:**
```text
Add an analytics data lineage flow to architectures/production-[system-name].json:

unique-id: "analytics-data-lineage"
name: "Analytics Data Pipeline"
description: "Data flow from user interactions to business intelligence"

Transitions:
1. Frontend → Analytics Collector: "User interaction events captured"
2. Analytics Collector → Message Queue: "Events published to queue"
3. Message Queue → Analytics Processor: "Batch processing of events"
4. Analytics Processor → Analytics Database: "Aggregated metrics stored"
5. Analytics Database → BI Dashboard: "Dashboards query aggregated data"

Add metadata to flow:
- data-classification: "anonymous"
- retention-policy: "90 days"
- purpose: "product improvement and business analytics"
```

### 6. Add Data Retention Controls

**Prompt:**
```text
Add data retention controls to relevant database nodes in architectures/production-[system-name].json:

For User Database:
- "data-retention" control
  - description: "Personal data retention and deletion policy"
  - requirements:
    - control-requirement-url: "https://internal-policy.example.com/data-retention"
    - control-config-url: "https://github.com/org/data-policies/user-data-retention.yml"

For Order Database:
- "financial-retention" control
  - description: "Financial records retention for compliance"
  - requirements:
    - control-requirement-url: "https://www.sox-law.com/records-retention.html"

For Analytics Database:
- "analytics-retention" control
  - description: "Analytics data retention policy"
  - requirements:
    - control-requirement-url: "https://internal-policy.example.com/analytics-retention"
```

### 7. Create Data Lineage Diagram

**File:** `docs/data-lineage-map.md`

**Content:**
```markdown
# Data Lineage Map

## Overview

This document maps how data flows through [System Name], derived from CALM flows.

## Architecture Reference

See flows in: `architectures/production-[system-name].json`

## Customer Data Journey

### Collection
- **Entry Point:** User registration form (Frontend)
- **Data Type:** Name, Email, Address, Phone
- **Classification:** PII (Personally Identifiable Information)

### Transmission
- **Protocol:** HTTPS
- **Encryption:** TLS 1.3
- **Components:** Frontend → API Gateway → User Service

### Storage
- **Database:** User Database (PostgreSQL)
- **Encryption:** AES-256 at rest
- **Access:** User Service only
- **Backup:** Daily, encrypted, 30-day retention

### Usage
- **Authentication:** Login verification
- **Personalization:** User profile display
- **Communication:** Email notifications

### Analytics (Anonymized)
- **Process:** Personal identifiers removed
- **Destination:** Analytics Database
- **Purpose:** Usage patterns, no individual tracking
- **Retention:** 90 days

### Deletion
- **Trigger:** User account deletion request
- **Process:** 
  1. Soft delete in User DB (30-day grace period)
  2. Hard delete after grace period
  3. Remove from backups after 30 days
- **Verification:** Deletion audit log

## Payment Data Journey

### Collection
- **Entry Point:** Checkout page
- **Data Type:** Credit card number, CVV, expiry
- **Classification:** PCI-DSS Sensitive

### Tokenization
- **Process:** Card data tokenized in frontend
- **Actual card data:** Never stored in our systems
- **Token:** Stored for future transactions

### Processing
- **Handler:** External payment gateway (PCI-compliant)
- **Our role:** Token submission only
- **Storage:** Transaction ID and status only (no card data)

### Retention
- **Transaction records:** 7 years (financial compliance)
- **Card tokens:** Until customer removes payment method
- **Actual card data:** Zero retention (handled by payment gateway)

## Analytics Data Journey

### Collection
- **Events:** Page views, clicks, searches
- **Data:** URL, timestamp, anonymized user ID
- **Classification:** Anonymous

### Processing
- **Component:** Analytics Processor
- **Transformation:** Aggregation, no individual tracking
- **Output:** Counts, averages, trends

### Storage
- **Database:** Analytics Database (ClickHouse)
- **Retention:** 90 days
- **Deletion:** Automatic time-based

### Consumption
- **Users:** Product team, marketing
- **Access:** BI dashboard (read-only)
- **Purpose:** Product decisions, not individual tracking

## Data Classification Summary

| Data Type | Classification | Retention | Deletion Process |
|-----------|---------------|-----------|------------------|
| Customer PII | Confidential | Indefinite | User-initiated deletion |
| Payment tokens | Restricted | Until removed | User-initiated |
| Order records | Confidential | 7 years | Automatic |
| Analytics | Anonymous | 90 days | Automatic |
| Session data | Internal | 24 hours | Automatic |

## Compliance Mapping

### GDPR Requirements

| Requirement | Implementation | CALM Reference |
|-------------|----------------|----------------|
| Right to access | API endpoint for data export | [Flow: customer-data-lineage] |
| Right to deletion | Deletion workflow | [Control: data-privacy] |
| Data minimization | Only collect necessary data | [Metadata: data-classification] |
| Purpose limitation | Analytics anonymized | [Flow: analytics-data-lineage] |

### PCI-DSS Requirements

| Requirement | Implementation | CALM Reference |
|-------------|----------------|----------------|
| No card storage | Tokenization | [Flow: payment-data-lineage] |
| Encrypted transmission | TLS 1.3 | [Relationship: protocol HTTPS] |
| Access control | Payment service only | [Control: pci-dss-compliance] |

## Data Subject Requests

### Access Request
**CALM Reference:** Follow customer-data-lineage flow to collect all data

### Deletion Request
**CALM Reference:** Follow customer-data-lineage flow in reverse to purge data

### Export Request
**CALM Reference:** Query all stores in customer-data-lineage flow
```

### 8. Create Data Governance Policy

**File:** `docs/data-governance-policy.md`

**Content:**
```markdown
# Data Governance Policy

Implemented in: `architectures/production-[system-name].json`

## Principles

1. **Data Minimization:** Collect only what's needed
2. **Purpose Limitation:** Use data only for stated purposes
3. **Storage Limitation:** Retain only as long as necessary
4. **Accuracy:** Keep data current and correct
5. **Security:** Protect against unauthorized access

## Data Classification

| Level | Examples | Requirements |
|-------|----------|--------------|
| Public | Product catalog | No restrictions |
| Internal | Aggregate analytics | Internal access only |
| Confidential | Customer PII | Encryption, access control |
| Restricted | Payment data | PCI-DSS compliance |

## Technical Controls

See `controls` in CALM architecture for implementation.

## Retention Policies

See flows in CALM architecture for data lifecycle.

## Audit Trail

All data access logged and monitored. Reference monitoring URLs in node metadata.
```

### 9. Validate Data Lineage Flows

```bash
calm validate -a architectures/production-[system-name].json
```

### 10. Generate Data Lineage Documentation

```bash
calm docify --architecture architectures/production-[system-name].json --template templates/comprehensive-bundle/flow-documentation.hbs --output docs/generated/data-flows.md
```

### 11. Create Visual Data Lineage Diagram

**Steps:**
1. Open `architectures/production-[system-name].json`
2. Open preview (Ctrl+Shift+C)
3. If preview shows flows, **take screenshot**
4. Alternatively, create a manual diagram based on flows
5. Save to `docs/screenshots/data-lineage-flows.png`

### 12. Test Data Subject Request Process

Document how to handle GDPR data subject requests using your architecture:

**File:** `docs/data-subject-request-process.md`

**Content:**
```markdown
# Data Subject Request Process

## Using CALM Architecture for Compliance

The CALM architecture (`architectures/production-[system-name].json`) contains all data lineage information needed to fulfill data subject requests.

## Process: Right to Access

1. **Identify data stores:**
   ```bash
   # Review customer-data-lineage flow
   # List all destination nodes where customer data is stored
   ```

2. **Query each store:**
   - User Database: SELECT * FROM users WHERE email = ...
   - Order Database: SELECT * FROM orders WHERE customer_id = ...
   - Analytics Database: (No PII stored)

3. **Compile response:**
   - Format: JSON export
   - Include all data points from lineage

## Process: Right to Deletion

1. **Follow flow in reverse:**
   ```
   customer-data-lineage flow → identify all stores
   ```

2. **Delete from each:**
   - User Database: DELETE FROM users WHERE email = ...
   - Order Database: Anonymize customer data in old orders
   - Analytics Database: No action (already anonymous)
   - Backups: Mark for purge

3. **Verify:**
   - Run queries to confirm deletion
   - Log deletion for audit

## CALM as Source of Truth

The CALM architecture ensures:
- All data stores are documented
- Data flows are traceable
- No hidden data repositories
- Compliance requirements are linked
```

### 13. Update Your README

Update the README checklist for Day 21 and note where the new lineage docs live (planning file, governance policy, subject request process, screenshots, and generated `data-flows` output).

### 14. Commit Data Lineage Work

```bash
git add architectures/production-*.json docs/data-*.md docs/screenshots README.md
git commit -m "Day 21: Model data lineage for compliance and governance"
git tag day-21
```

## Deliverables

✅ **Required:**
- Enhanced `architectures/production-[system-name].json` with:
  - Customer data lineage flow
  - Payment data lineage flow
  - Analytics data lineage flow
  - Data retention controls on database nodes
- `docs/data-lineage-planning.md` - Data flow planning
- `docs/data-lineage-map.md` - Complete lineage documentation
- `docs/data-governance-policy.md` - Governance policy
- `docs/data-subject-request-process.md` - GDPR compliance process
- `docs/generated/data-flows.md` - Generated flow docs
- `docs/screenshots/data-lineage-flows.png` - Visual representation
- Updated `README.md` - Day 21 marked complete

✅ **Validation:**
```bash
# Validate architecture
calm validate -a architectures/production-*.json

# Check for data lineage flows
grep -q 'customer-data-lineage' architectures/production-*.json
grep -q 'payment-data-lineage' architectures/production-*.json
grep -q 'analytics-data-lineage' architectures/production-*.json

# Check for data controls
grep -q 'data-retention' architectures/production-*.json
grep -q 'data-privacy' architectures/production-*.json

# Verify documentation
test -f docs/data-lineage-map.md
test -f docs/data-governance-policy.md

# Check tag
git tag | grep -q "day-21"
```

## Resources
- [GDPR Data Lineage Requirements](https://gdpr.eu/data-processing/)
- [Data Lineage Best Practices](https://www.dataversity.net/what-is-data-lineage/)
- [PCI-DSS Data Retention](https://www.pcisecuritystandards.org/)

## Tips
- Data lineage helps with compliance audits
- Flows make data subject requests tractable
- Document transformations (anonymization, encryption)
- Link retention policies to controls
- Use flows to verify complete data deletion
- Update lineage when adding new data stores
- Data lineage is valuable for:
  - GDPR/CCPA compliance
  - Data quality debugging
  - Impact analysis (what breaks if we change this?)
  - Security audits

## Next Steps
Tomorrow (Day 22) you'll migrate existing documentation to CALM!
