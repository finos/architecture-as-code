# CALM Draft Folder References Checklist

This document tracks all references to files in the `calm/draft` folder and its subdirectories throughout the monorepo.

## GitHub Workflows

### .github/workflows/s3-sync.yml
- [x] Line 13: Path trigger `'calm/draft/**'`
- [x] Line 31: Comment "Sync calm/draft folder to S3"
- [x] Line 33: AWS S3 sync command

These references are all safe.

### .github/workflows/validate-spectral.yml
- [x] Line 11: Path trigger `'calm/draft/**'`
- [x] Line 19: Path trigger `'calm/draft/**'`

These references are all safe.

## Documentation

### calm/README.md
- [x] Line 33: Reference to `calm/draft/#issue-number`
- [x] Line 41: Reference to `calm/draft/#issue-number` for schema changes
- [x] Line 43: Reference to `calm/draft/#issue-number/prototype` for examples

These references are all safe.

## Build Configuration

### cli/package.json
- [x] Line 20: Copy command `"../calm/draft/**/meta/*"`

This is a safe reference

## Test Files

### shared/src/commands/generate/generate.spec.ts
- [x] Line 19: `'../calm/draft/2025-03/meta'`

This is an unused mock - removed in commit 4c6c69de87dc9fbbe52dd5a3eba0c2c9bea7c832

### shared/src/commands/validate/validate.spec.ts
- [x] Line 199: Schema path to `2024-10/meta/interface.json`
- [x] Line 214: Schema path to `2024-10/meta/interface.json`

Above references changed in commit 644f5ea0408fb633dd10c7c6710130cef70ecca5

- [x] Line 563: Schema reference to `2024-03/meta/calm.json`

Above line was a meaningless test - removed in commit 9ea28d6299537075e1939f7d49c4d7bfeb9e0914

### shared/src/schema-directory.spec.ts
- [x] Line 57: Node ref to `2024-03/meta/core.json`

Updated to release schema in the calm project in commit 12c24a6629bcad77583cf0fb3bbf3e71fb8259fb. This makes the test more valuable as it will fail if the release version were to be removed and the test weren't updated.

## Test Fixtures - shared/test_fixtures/

### Core Schema Files
- [x] `calm.json` - References `2024-03/meta/`
- [x] `core.json` - References `2024-03/meta/`
- [x] `calm/calm.json` - References `2024-03/meta/`
- [x] `calm/core.json` - References `2024-03/meta/`

Removed redundant files in commit ede477a851bb9cc8d0648f2f7c8859758d5bfb4a

### Example Architectures (2024-03)
- [x] `api-gateway.json` - Multiple refs to `2024-03/meta/`
- [x] `api-gateway-with-no-relationships.json` - Multiple refs to `2024-03/meta/`

Above to files updated with release relevant references in commit c510407427f5d008374963cd4e320426926803b0

- [x] `additional-props.json` - Multiple refs to `2024-03/meta/`

Removed in commit 795efea80164002ad82a6e46e1f51f42291f537f as no references

### Example Architectures (2024-04)
- [x] `api-gateway-self-reference.json` - References `2024-04/meta/`

Removed as unused in commit b5076bcdf86e54d7036297fcd0c98149c414cafc

- [x] `bad-schema/bad-json-schema.json` - References `2024-04/meta/`

Updated in commit 1c32ca7a0f75ff5e04d52bd1834da09082a24e6a as this is clearly intended to drive genuinely useful tests, **however** this file isn't referenced in any tests, will create an issue to subsequently add useful tests.

### Schema Directory
- [x] `schema-directory/recursive.json` - References `2024-03/meta/`

Updated in commit 27e4029b9924b65b161c9346799838ed2e23cc64

### Template Files (2024-12)
- [x] `template/data/document-system.json` - References `2024-12/meta/flow.json`
- [x] `template/data/document-system-with-controls.json` - References `2024-12/meta/flow.json`

Updated in commit 15e185d919d42c7603929b149f118351696ea040

### Sample Flows (2024-12)
- [x] `samples/2024-12/flows/trade-processing/trade-processing-update-trade.json`
- [x] `samples/2024-12/flows/trade-processing/trade-processing-new-trade.json`
- [x] `samples/2024-12/flows/load-positions/load-positions.json`
- [x] `samples/2024-12/flows/submit-trade-ticket/submit-trade-ticket.json`
- [x] `samples/2024-12/flows/add-update-account/add-update-account.json`
- [x] `samples/2024-12/flows/load-list-of-accounts/load-list-of-accounts.json`

Removed the entire samples directory as none of the files are being referenced - commit 9f17022edb14da69a530a7381cfa1baf29d84d1a

## CLI Test Fixtures - cli/test_fixtures/

### Template Files
- [ ] `template/model/document-system.json` - References `2024-12/meta/flow.json`

## Database Initialization

### calm-hub/nitrite/init-nitrite.sh
- [ ] Line 1197: `2024-04/meta/calm.json`
- [ ] Line 1208: `2024-04/meta/calm.json`
- [ ] Line 1219: `2024-10/meta/flow.json`
- [ ] Line 1260: `2024-10/meta/flow.json`
- [ ] Line 1301: `2024-04/meta/calm.json`
- [ ] Line 1453: `2025-03/meta/calm.json`

### calm-hub/mongo/init-mongo.js
- [ ] Line 1946: `2024-04/meta/calm.json`
- [ ] Line 1958: `2024-04/meta/calm.json`
- [ ] Line 1977: `2024-10/meta/flow.json`
- [ ] Line 2020: `2024-10/meta/flow.json`
- [ ] Line 2066: `2024-04/meta/calm.json`
- [ ] Line 2228: `2025-03/meta/calm.json`

### calm-hub/k8s/mongo-config.yml
- [ ] Line 26: `$id` for `2024-04/meta/calm.json`
- [ ] Line 35: Schema ref to `2024-04/meta/core.json`
- [ ] Line 42: `$ref` to `2024-04/meta/core.json`
- [ ] Line 47: `$id` for `2024-04/meta/core.json`
- [ ] Line 299: `$id` for `2024-04/meta/interface.json`
- [ ] Line 461: `$id` for `2024-10/meta/calm.json`
- [ ] Line 470: Schema ref to `2024-10/meta/core.json`
- [ ] Line 477: `$ref` to `2024-10/meta/core.json`
- [ ] Line 482: `$id` for `2024-10/meta/control.json`
- [ ] Line 530: `$id` for `2024-10/meta/control-requirement.json`
- [ ] Line 563: `$id` for `2024-10/meta/core.json`
- [ ] Line 825: `$id` for `2024-10/meta/evidence.json`
- [ ] Line 862: `$id` for `2024-10/meta/flow.json`
- [ ] Line 890: `$ref` to `2024-10/meta/control.json#/defs/controls`
- [ ] Line 943: `$id` for `2024-10/meta/interface.json`
- [ ] Line 1124: `$id` for `2024-10/meta/units.json`
- [ ] Lines 1204-1414: Multiple `$schema` and `$ref` to `2024-04/meta/` schemas

## Release Folder References (calm/release/)

### 1.0-rc1/prototype/
- [ ] `interfaces/kafka-topic.json` - `$id` to `draft/1083/interfaces/kafka-topic`
- [ ] `interfaces/grpc-service.json` - `$id` to `draft/1083/interfaces/grpc-service`
- [ ] `authentication-control-requirement.json` - `$id` to `draft/1177/prototype/`
- [ ] `authentication-control-config.json` - `$id` to `draft/1177/prototype/`
- [ ] `access-control-requirement.json` - `$id` to `draft/1233/prototype/`
- [ ] `data-encryption-requirement.json` - `$id` to `draft/1233/prototype/`
- [ ] `conditional_nested_authentication_control_requirement.json` - `$id` to `draft/1233/prototype/`

### 1.0-rc2/prototype/
- [ ] `interfaces/kafka-topic.json` - `$id` to `draft/1083/interfaces/kafka-topic`
- [ ] `interfaces/grpc-service.json` - `$id` to `draft/1083/interfaces/grpc-service`
- [ ] `authentication-control-requirement.json` - `$id` to `draft/1177/prototype/`
- [ ] `authentication-control-config.json` - `$id` to `draft/1177/prototype/`
- [ ] `access-control-requirement.json` - `$id` to `draft/1233/prototype/`
- [ ] `data-encryption-requirement.json` - `$id` to `draft/1233/prototype/`
- [ ] `conditional_nested_authentication_control_requirement.json` - `$id` to `draft/1233/prototype/`

## Self-References within calm/draft/

### Draft 1083 (Interfaces)
- [ ] `meta/calm.json` - Self `$id` and refs
- [ ] `meta/core.json` - Self `$id`
- [ ] `meta/interface.json` - Self `$id`
- [ ] `prototype/example-architecture.json` - References to `1083/interfaces/`
- [ ] `prototype/interfaces/kafka-topic.json` - Self `$id`
- [ ] `prototype/interfaces/grpc-service.json` - Self `$id`
- [ ] `README.md` - Line 89: Interface definition URL

### Draft 1177 (Authentication)
- [ ] `meta/core.json` - Self `$id`
- [ ] `prototype/authentication-control-requirement.json` - Self `$id`
- [ ] `prototype/authentication-control-config.json` - Self `$id`
- [ ] `prototype/authentication-as-control.json` - References to `1177/prototype/`
- [ ] `README.md` - Lines 72-73: Control URLs

### Draft 1224 (Metadata)
- [ ] `meta/core.json` - Self `$id`
- [ ] `prototype/api-gateway.json` - Schema ref to `1224/meta/calm.json`
- [ ] `README.md` - Line 44: Schema example

### Draft 1232 (Core)
- [ ] `meta/core.json` - Self `$id`

### Draft 1233 (Access Control & Encryption)
- [ ] `meta/control.json` - Self `$id`
- [ ] `prototype/access-control-requirement.json` - Self `$id`
- [ ] `prototype/data-encryption-requirement.json` - Self `$id`
- [ ] `prototype/example-url-config.json` - Multiple refs to `1233/prototype/`
- [ ] `prototype/example-inline-config.json` - Multiple refs to `1233/prototype/`
- [ ] `prototype/example-mixed-config.json` - Multiple refs to `1233/prototype/`

### Draft 2024-02
- [ ] `meta/calm.json` - Self `$id` and refs to `core.json`
- [ ] `meta/core.json` - Self `$id`

### Draft 2024-03
- [ ] `meta/calm.json` - Self `$id` and refs to `core.json`
- [ ] `meta/core.json` - Self `$id`

### Draft 2024-04
- [ ] `meta/calm.json` - Self `$id` and refs to `core.json`
- [ ] `meta/core.json` - Self `$id`
- [ ] `meta/interface.json` - Self `$id`

### Draft 2024-08
- [ ] `meta/calm.json` - Self `$id` and refs to `core.json`
- [ ] `meta/core.json` - Self `$id`
- [ ] `meta/control.json` - Self `$id`
- [ ] `meta/control-requirement.json` - Self `$id`
- [ ] `meta/evidence.json` - Self `$id`
- [ ] `meta/interface.json` - Self `$id`

### Draft 2024-10
- [ ] `meta/calm.json` - Self `$id` and refs to `core.json`
- [ ] `meta/core.json` - Self `$id`
- [ ] `meta/control.json` - Self `$id`
- [ ] `meta/control-requirement.json` - Self `$id`
- [ ] `meta/evidence.json` - Self `$id`
- [ ] `meta/flow.json` - Self `$id` and refs to `control.json`
- [ ] `meta/interface.json` - Self `$id`
- [ ] `meta/units.json` - Self `$id`

### Draft 2024-12
- [ ] `meta/control.json` - Self `$id`
- [ ] `meta/control-requirement.json` - Self `$id`
- [ ] `meta/evidence.json` - Self `$id`
- [ ] `meta/flow.json` - Self `$id`
- [ ] `meta/interface.json` - Self `$id`
- [ ] `meta/units.json` - Self `$id`

### Draft 2025-03

#### Meta Schemas
- [ ] `meta/calm.json` - Self `$id` and refs to `core.json`
- [ ] `meta/core.json` - Self `$id`
- [ ] `meta/control.json` - Self `$id`
- [ ] `meta/control-requirement.json` - Self `$id`
- [ ] `meta/evidence.json` - Self `$id`
- [ ] `meta/flow.json` - Self `$id`
- [ ] `meta/interface.json` - Self `$id`
- [ ] `meta/units.json` - Self `$id`

#### Prototypes
- [ ] `prototype/throughput-control-prototype.json` - Refs to `2025-03/meta/`
- [ ] `prototype/oneof/options-prototype.pattern.json` - Multiple refs to `2025-03/meta/core.json`
- [ ] `prototype/oneof/application-a.architecture.json` - Schema ref
- [ ] `prototype/oneof/application-b.architecture.json` - Schema ref
- [ ] `prototype/anyof/options-prototype.pattern.json` - Multiple refs to `2025-03/meta/core.json`
- [ ] `prototype/anyof/both-options.architecture.json` - Schema ref
- [ ] `prototype/anyof/neither-option.architecture.json` - Schema ref
- [ ] `prototype/multiple-choices/options-prototype.pattern.json` - Multiple refs to `2025-03/meta/core.json`
- [ ] `prototype/multiple-choices/architecture.json` - Schema ref

#### TraderX Samples - Business Logic
- [ ] `samples/traderx/control-requirement/business_logic_and_process_control/business-logic-enforcement-control-requirement.json`

#### TraderX Samples - Compliance & Governance
- [ ] `samples/traderx/control-requirement/compliance_and_governance/approval-workflow-control-requirement.json`
- [ ] `samples/traderx/control-requirement/compliance_and_governance/change-management-control-requirement.json`
- [ ] `samples/traderx/control-requirement/compliance_and_governance/review-adjustments-control-requirement.json`

#### TraderX Samples - Data Integrity & Retention
- [ ] `samples/traderx/control-requirement/data_integrity_and_retention/data-consistency-requirement.json`
- [ ] `samples/traderx/control-requirement/data_integrity_and_retention/data-integrity-control-requirement.json`
- [ ] `samples/traderx/control-requirement/data_integrity_and_retention/data-retention-control-requirement.json`
- [ ] `samples/traderx/control-requirement/data_integrity_and_retention/schema-validation-control-requirement.json`

#### TraderX Samples - Monitoring & Observability
- [ ] `samples/traderx/control-requirement/monitoring_and_observability/alerting-control-requirement.json`
- [ ] `samples/traderx/control-requirement/monitoring_and_observability/db-monitoring-control-requirement.json`
- [ ] `samples/traderx/control-requirement/monitoring_and_observability/health-check-requirement.json`
- [ ] `samples/traderx/control-requirement/monitoring_and_observability/logging-control-requirement.json`
- [ ] `samples/traderx/control-requirement/monitoring_and_observability/monitoring-control-requirement.json`
- [ ] `samples/traderx/control-requirement/monitoring_and_observability/tracing-control-requirement.json`

#### TraderX Samples - Performance & Scalability
- [ ] `samples/traderx/control-requirement/performance_and_scalability/latency-control-requirement.json`
- [ ] `samples/traderx/control-requirement/performance_and_scalability/resource-utilization-control-requirement.json`
- [ ] `samples/traderx/control-requirement/performance_and_scalability/scalability-control-requirement.json`
- [ ] `samples/traderx/control-requirement/performance_and_scalability/throughput-control-requirement.json`
- [ ] `samples/traderx/control-requirement/performance_and_scalability/timeout-handling-control-requirement.json`

#### TraderX Samples - Resilience & Risk Management
- [ ] `samples/traderx/control-requirement/resilience_and_risk_management/availability-control-requirement.json`
- [ ] `samples/traderx/control-requirement/resilience_and_risk_management/disaster-recovery-control-requirement.json`
- [ ] `samples/traderx/control-requirement/resilience_and_risk_management/error-handling-control-requirement.json`
- [ ] `samples/traderx/control-requirement/resilience_and_risk_management/escalation-path-control-requirement.json`
- [ ] `samples/traderx/control-requirement/resilience_and_risk_management/failover-redundancy-control-requirement.json`
- [ ] `samples/traderx/control-requirement/resilience_and_risk_management/incident-response-control-requirement.json`
- [ ] `samples/traderx/control-requirement/resilience_and_risk_management/risk-management-control-requirement.json`

#### TraderX Samples - Security & Access Control
- [ ] `samples/traderx/control-requirement/security_and_access_control/api-rate-limiting-control-requirement.json`
- [ ] `samples/traderx/control-requirement/security_and_access_control/audit-logging-control-requirement.json`
- [ ] `samples/traderx/control-requirement/security_and_access_control/authentication-control-requirement.json`
- [ ] `samples/traderx/control-requirement/security_and_access_control/authorization-control-requirement.json`
- [ ] `samples/traderx/control-requirement/security_and_access_control/data-encryption-control-requirement.json`
- [ ] `samples/traderx/control-requirement/security_and_access_control/secrets-management-control-requirement.json`

---

## Summary Statistics

- **Total Draft Versions**: 11 (1083, 1177, 1224, 1232, 1233, 2024-02, 2024-03, 2024-04, 2024-08, 2024-10, 2024-12, 2025-03)
- **GitHub Workflows**: 2 files, 5 references
- **Documentation**: 1 file, 3 references
- **Build Config**: 1 file, 1 reference
- **Test Files**: 3 files, 5+ references
- **Test Fixtures**: 20+ files
- **Database Init**: 3 files, 40+ references
- **Release Folder**: 14 files referencing drafts
- **Draft Self-References**: 100+ files (meta schemas, prototypes, samples)

---

**Generated**: October 27, 2025
