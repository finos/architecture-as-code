package org.finos.calm.mcp.api.tools;

import io.quarkiverse.mcp.server.Tool;

public class ControlCreationTool {

    public static class ControlCreationToolResponse {
        private final String schema;
        private final String example;
        private final String notes;

        public ControlCreationToolResponse(String schema, String example, String notes) {
            this.schema = schema;
            this.example = example;
            this.notes = notes;
        }

        public String getSchema() {
            return schema;
        }

        public String getExample() {
            return example;
        }

        public String getNotes() {
            return notes;
        }
    }

    @Tool(
            name = "controlCreationTool",
            description = "Provides details for creating controls in CALM architecture documents, including the relationship between control-requirements and control-configurations"
    )
    public ControlCreationToolResponse controlCreationTool() {
        return new ControlCreationToolResponse(
                """
                        # CALM Control Schema (release/1.0-rc1)
                        
                        Controls in CALM define requirements and their implementations for domains like security, compliance, and governance.
                        
                        ## Key Concept: Control Requirements vs Control Configurations
                        
                        **Control Requirement**: A schema that defines what properties a control must have
                        **Control Configuration**: An instance that conforms to a control requirement schema
                        
                        ## Control Detail Schema
                        "control-detail": {
                          "type": "object",
                          "properties": {
                            "control-requirement-url": {
                              "type": "string",
                              "description": "The requirement schema that specifies how a control should be defined"
                            },
                            "control-config-url": {
                              "type": "string", 
                              "description": "The configuration of how the control requirement schema is met"
                            },
                            "control-config": {
                              "type": "object",
                              "description": "Inline configuration of how the control requirement schema is met"
                            }
                          },
                          "required": ["control-requirement-url"],
                          "oneOf": [
                            { "required": ["control-config-url"] },
                            { "required": ["control-config"] }
                          ]
                        }
                        
                        ## Controls Schema
                        "controls": {
                          "type": "object",
                          "patternProperties": {
                            "^[a-zA-Z0-9-]+$": {
                              "type": "object",
                              "properties": {
                                "description": {
                                  "type": "string",
                                  "description": "A description of a control and how it applies to a given architecture"
                                },
                                "requirements": {
                                  "type": "array",
                                  "items": {
                                    "$ref": "#/defs/control-detail"
                                  }
                                }
                              },
                              "required": ["description", "requirements"]
                            }
                          }
                        }
                        
                        ## Control Requirement Schema (Base)
                        "control-requirement": {
                          "type": "object",
                          "properties": {
                            "control-id": {
                              "type": "string",
                              "description": "The unique identifier of this control"
                            },
                            "name": {
                              "type": "string", 
                              "description": "The name of the control requirement"
                            },
                            "description": {
                              "type": "string",
                              "description": "A detailed description of the control"
                            }
                          },
                          "required": ["control-id", "name", "description"]
                        }
                        
                        ## Usage in Architecture
                        Controls can be applied to:
                        - Architecture level (top-level controls)
                        - Node level (node-specific controls)
                        - Relationship level (connection controls)
                        - Flow level (process controls)
                        """,
                """
                        # Complete Control Examples
                        
                        ## 🛡️ Architecture with Controls (Full Example)
                        {
                          "$schema": "https://calm.finos.org/release/1.0-rc1/meta/calm.json",
                          "unique-id": "secure-trading-platform",
                          "name": "Secure Trading Platform",
                          "description": "Trading platform with comprehensive security controls",
                          
                          "controls": {
                            "network-security": {
                              "description": "Network-level security controls for the trading platform",
                              "requirements": [
                                {
                                  "control-requirement-url": "https://calm.finos.org/workshop/controls/micro-segmentation.requirement.json",
                                  "control-config": {
                                    "control-id": "security-001",
                                    "name": "Micro-segmentation of Trading Network",
                                    "description": "Network micro-segmentation to prevent lateral movement",
                                    "permit-ingress": true,
                                    "permit-egress": false,
                                    "network-zones": ["trading", "settlement", "reporting"]
                                  }
                                }
                              ]
                            },
                            
                            "data-protection": {
                              "description": "Data protection and encryption controls",
                              "requirements": [
                                {
                                  "control-requirement-url": "https://calm.finos.org/workshop/controls/encryption.requirement.json",
                                  "control-config": {
                                    "control-id": "security-003",
                                    "name": "Data Encryption at Rest and in Transit",
                                    "description": "All sensitive data must be encrypted using approved algorithms",
                                    "encryption-at-rest": {
                                      "algorithm": "AES-256",
                                      "key-management": "HSM"
                                    },
                                    "encryption-in-transit": {
                                      "protocol": "TLS 1.3",
                                      "certificate-validation": "required"
                                    }
                                  }
                                }
                              ]
                            }
                          },
                          
                          "nodes": [
                            {
                              "unique-id": "trading-api",
                              "node-type": "service",
                              "name": "Trading API",
                              "description": "Core trading service",
                              "controls": {
                                "api-security": {
                                  "description": "API-specific security controls",
                                  "requirements": [
                                    {
                                      "control-requirement-url": "https://calm.finos.org/workshop/controls/api-security.requirement.json",
                                      "control-config": {
                                        "control-id": "api-001",
                                        "name": "API Authentication and Authorization",
                                        "description": "Secure API access with OAuth2 and rate limiting",
                                        "authentication": {
                                          "type": "OAuth2",
                                          "scopes": ["trade:read", "trade:write"],
                                          "token-expiry": "1h"
                                        },
                                        "rate-limiting": {
                                          "requests-per-minute": 1000,
                                          "burst-limit": 100
                                        },
                                        "input-validation": {
                                          "schema-validation": "required",
                                          "sanitization": "enabled"
                                        }
                                      }
                                    }
                                  ]
                                }
                              }
                            }
                          ],
                          
                          "relationships": [
                            {
                              "unique-id": "api-to-database",
                              "description": "Trading API to database connection",
                              "relationship-type": {
                                "connects": {
                                  "source": { "node": "trading-api" },
                                  "destination": { "node": "trade-database" }
                                }
                              },
                              "protocol": "JDBC",
                              "controls": {
                                "database-access": {
                                  "description": "Database connection security controls",
                                  "requirements": [
                                    {
                                      "control-requirement-url": "https://calm.finos.org/workshop/controls/permitted-connection.requirement.json",
                                      "control-config": {
                                        "control-id": "security-002",
                                        "name": "Permitted Database Connection",
                                        "description": "Allows secure JDBC connection to trade database",
                                        "reason": "Required for trade data persistence",
                                        "protocol": "JDBC",
                                        "encryption": "TLS",
                                        "authentication": "certificate-based"
                                      }
                                    }
                                  ]
                                }
                              }
                            }
                          ],
                          
                          "flows": [
                            {
                              "unique-id": "trade-processing-flow",
                              "name": "Trade Processing Flow",
                              "description": "End-to-end trade processing with compliance controls",
                              "transitions": [
                                {
                                  "relationship-unique-id": "api-to-database",
                                  "sequence-number": 1,
                                  "summary": "Store validated trade in database"
                                }
                              ],
                              "controls": {
                                "compliance-audit": {
                                  "description": "Regulatory compliance and audit controls for trade processing",
                                  "requirements": [
                                    {
                                      "control-requirement-url": "https://calm.finos.org/workshop/controls/audit-logging.requirement.json",
                                      "control-config": {
                                        "control-id": "compliance-001",
                                        "name": "Trade Audit Logging",
                                        "description": "Comprehensive audit logging for all trade transactions",
                                        "log-level": "detailed",
                                        "retention-period": "7-years",
                                        "log-integrity": "hash-protected",
                                        "real-time-monitoring": "enabled",
                                        "compliance-frameworks": ["MiFID II", "Dodd-Frank"]
                                      }
                                    }
                                  ]
                                }
                              }
                            }
                          ]
                        }
                        
                        ## 🔐 External Control Configuration (Separate File)
                        
                        ### Control Requirement Schema (micro-segmentation.requirement.json)
                        {
                          "$schema": "https://json-schema.org/draft/2020-12/schema",
                          "$id": "https://calm.finos.org/workshop/controls/micro-segmentation.requirement.json",
                          "title": "Micro-segmentation Control Requirement",
                          "type": "object",
                          "properties": {
                            "control-id": { "type": "string" },
                            "name": { "type": "string" },
                            "description": { "type": "string" },
                            "permit-ingress": { "type": "boolean" },
                            "permit-egress": { "type": "boolean" },
                            "network-zones": {
                              "type": "array",
                              "items": { "type": "string" }
                            }
                          },
                          "required": ["control-id", "name", "description", "permit-ingress", "permit-egress"]
                        }
                        
                        ### Control Configuration (micro-segmentation.config.json)
                        {
                          "$schema": "https://calm.finos.org/workshop/controls/micro-segmentation.requirement.json",
                          "$id": "https://calm.finos.org/workshop/controls/micro-segmentation.config.json",
                          "control-id": "security-001",
                          "name": "Micro-segmentation of Kubernetes Cluster",
                          "description": "Micro-segmentation in place to prevent lateral movement outside of permitted flows",
                          "permit-ingress": true,
                          "permit-egress": false,
                          "network-zones": ["web-tier", "api-tier", "data-tier"]
                        }
                        
                        ### Using External Configuration
                        {
                          "controls": {
                            "network-security": {
                              "description": "Network security controls using external configuration",
                              "requirements": [
                                {
                                  "control-requirement-url": "https://calm.finos.org/workshop/controls/micro-segmentation.requirement.json",
                                  "control-config-url": "https://calm.finos.org/workshop/controls/micro-segmentation.config.json"
                                }
                              ]
                            }
                          }
                        }
                        
                        ## 🔒 Common Control Patterns
                        
                        ### Security Controls
                        - Authentication/Authorization (OAuth2, RBAC, API keys)
                        - Network Security (firewalls, micro-segmentation, VPNs)
                        - Data Protection (encryption, tokenization, masking)
                        - Access Control (least privilege, zero trust)
                        
                        ### Compliance Controls  
                        - Audit Logging (transaction logs, access logs, change logs)
                        - Data Governance (retention, classification, lineage)
                        - Regulatory Compliance (SOX, PCI-DSS, GDPR, MiFID II)
                        - Risk Management (monitoring, alerting, incident response)
                        
                        ### Operational Controls
                        - Performance (SLAs, monitoring, alerting)
                        - Availability (redundancy, failover, disaster recovery)
                        - Capacity (scaling, resource limits, quotas)
                        - Change Management (deployment gates, rollback procedures)
                        """,
                """
                        Controls in CALM 1.0-rc1 provide a powerful mechanism for defining and implementing requirements across security, compliance, and operational domains.
                        
                        ## Key Concepts:
                        
                        ### Control Requirements vs Control Configurations
                        • **Control Requirement**: A JSON schema that defines the structure and properties a control must have
                        • **Control Configuration**: A concrete instance that conforms to a control requirement schema
                        • **Separation of Concerns**: Requirements define "what", configurations define "how"
                        
                        ### Two Configuration Approaches:
                        • **Inline Configuration**: `control-config` object embedded directly in the architecture
                        • **External Configuration**: `control-config-url` pointing to a separate configuration file
                        
                        ## Control Structure:
                        • **Control Group**: Named collection of related control requirements (e.g., "network-security")
                        • **Description**: Explains how the control group applies to the architecture
                        • **Requirements Array**: List of control-detail objects, each with requirement URL and configuration
                        
                        ## Control Scope:
                        Controls can be applied at multiple levels:
                        • **Architecture Level**: Global controls affecting the entire system
                        • **Node Level**: Controls specific to individual components
                        • **Relationship Level**: Controls governing connections between components
                        • **Flow Level**: Controls applied to business processes
                        
                        ## Control Requirement Schema:
                        All control requirements must include:
                        • **control-id**: Unique identifier for linking evidence and auditing
                        • **name**: Human-readable name providing contextual meaning
                        • **description**: Detailed explanation of what developers need to consider
                        
                        ## Common Control Domains:
                        • **Security**: Authentication, authorization, encryption, network security
                        • **Compliance**: Audit logging, data governance, regulatory requirements
                        • **Operational**: Performance, availability, capacity, change management
                        • **Quality**: Testing, code review, deployment standards
                        
                        ## Best Practices:
                        • **Reusable Requirements**: Create control requirement schemas that can be reused across projects
                        • **Granular Controls**: Define specific, measurable control requirements
                        • **Evidence Linking**: Use control-id for linking to evidence and audit trails
                        • **Layered Controls**: Apply controls at appropriate architectural levels
                        • **Configuration Management**: Use external configurations for complex or shared controls
                        • **Domain Grouping**: Group related controls logically (security, compliance, etc.)
                        
                        ## Validation Rules:
                        • Control requirement URL must point to a valid JSON schema
                        • Control configuration must conform to the referenced requirement schema
                        • Either control-config or control-config-url must be provided (not both)
                        • Control IDs should be unique within the architecture scope
                        • All required properties from the control requirement schema must be satisfied
                        """
        );
    }
}
