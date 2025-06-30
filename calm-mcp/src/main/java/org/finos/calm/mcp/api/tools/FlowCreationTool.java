package org.finos.calm.mcp.api.tools;

import io.quarkiverse.mcp.server.Tool;

public class FlowCreationTool {

    public static class FlowCreationToolResponse {
        private final String schema;
        private final String example;
        private final String notes;

        public FlowCreationToolResponse(String schema, String example, String notes) {
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
            name = "flowCreationTool",
            description = "Provides details for creating flows in CALM architecture documents"
    )
    public FlowCreationToolResponse flowCreationTool() {
        return new FlowCreationToolResponse(
                """
                        # CALM Flow Schema (release/1.0-rc1)
                        
                        Flows describe business-level movement of data or actions across your architecture, mapping to existing relationships.
                        
                        ## Flow Definition
                        "flow": {
                          "type": "object",
                          "properties": {
                            "unique-id": {
                              "type": "string",
                              "description": "Unique identifier for the flow"
                            },
                            "name": {
                              "type": "string",
                              "description": "Descriptive name for the business flow"
                            },
                            "description": {
                              "type": "string",
                              "description": "Detailed description of the flow's purpose"
                            },
                            "requirement-url": {
                              "type": "string",
                              "description": "Link to a detailed requirement document"
                            },
                            "transitions": {
                              "type": "array",
                              "items": {
                                "$ref": "#/defs/transition"
                              },
                              "minItems": 1
                            },
                            "controls": {
                              "$ref": "control.json#/defs/controls"
                            },
                            "metadata": {
                              "$ref": "core.json#/defs/metadata"
                            }
                          },
                          "required": [
                            "unique-id",
                            "name",
                            "description",
                            "transitions"
                          ]
                        }
                        
                        ## Transition Definition
                        "transition": {
                          "type": "object",
                          "properties": {
                            "relationship-unique-id": {
                              "type": "string",
                              "description": "Unique identifier for the relationship in the architecture"
                            },
                            "sequence-number": {
                              "type": "integer",
                              "description": "Indicates the sequence of the relationship in the flow"
                            },
                            "summary": {
                              "type": "string",
                              "description": "Functional summary of what is happening in the transition"
                            },
                            "direction": {
                              "enum": [
                                "source-to-destination",
                                "destination-to-source"
                              ],
                              "default": "source-to-destination"
                            }
                          },
                          "required": [
                            "relationship-unique-id",
                            "sequence-number",
                            "summary"
                          ]
                        }
                        
                        ## Usage in Architecture
                        "flows": {
                          "type": "array",
                          "items": {
                            "$ref": "flow.json#/defs/flow"
                          }
                        }
                        """,
                """
                        # Complete Flow Examples
                        
                        ## 🔁 Simple Trade Execution Flow
                        {
                          "unique-id": "flow-trade-execution",
                          "name": "Trade Execution Flow",
                          "description": "End-to-end flow for processing a trade from submission to settlement",
                          "transitions": [
                            {
                              "relationship-unique-id": "web-to-api",
                              "sequence-number": 1,
                              "summary": "User submits trade via web interface",
                              "direction": "source-to-destination"
                            },
                            {
                              "relationship-unique-id": "api-to-database",
                              "sequence-number": 2,
                              "summary": "API validates and stores trade in database",
                              "direction": "source-to-destination"
                            },
                            {
                              "relationship-unique-id": "api-to-kafka",
                              "sequence-number": 3,
                              "summary": "API publishes trade event to message queue",
                              "direction": "source-to-destination"
                            }
                          ]
                        }
                        
                        ## 🔄 Bidirectional User Authentication Flow
                        {
                          "unique-id": "flow-user-authentication",
                          "name": "User Authentication Flow",
                          "description": "Complete user login and session management process",
                          "requirement-url": "https://internal.docs/auth-requirements.md",
                          "transitions": [
                            {
                              "relationship-unique-id": "frontend-to-auth-service",
                              "sequence-number": 1,
                              "summary": "Frontend sends login credentials to auth service",
                              "direction": "source-to-destination"
                            },
                            {
                              "relationship-unique-id": "auth-service-to-user-db",
                              "sequence-number": 2,
                              "summary": "Auth service validates credentials against user database",
                              "direction": "source-to-destination"
                            },
                            {
                              "relationship-unique-id": "auth-service-to-user-db",
                              "sequence-number": 3,
                              "summary": "Database returns user profile and permissions",
                              "direction": "destination-to-source"
                            },
                            {
                              "relationship-unique-id": "frontend-to-auth-service",
                              "sequence-number": 4,
                              "summary": "Auth service returns JWT token and user session",
                              "direction": "destination-to-source"
                            }
                          ]
                        }
                        
                        ## 🏦 Complex Financial Transaction Flow with Controls
                        {
                          "unique-id": "flow-payment-processing",
                          "name": "Payment Processing Flow",
                          "description": "Secure payment processing with fraud detection and compliance checks",
                          "requirement-url": "https://compliance.internal/payment-reqs.pdf",
                          "transitions": [
                            {
                              "relationship-unique-id": "payment-ui-to-gateway",
                              "sequence-number": 1,
                              "summary": "User initiates payment through secure UI",
                              "direction": "source-to-destination"
                            },
                            {
                              "relationship-unique-id": "gateway-to-fraud-service",
                              "sequence-number": 2,
                              "summary": "Gateway sends transaction for fraud analysis",
                              "direction": "source-to-destination"
                            },
                            {
                              "relationship-unique-id": "fraud-service-to-ml-engine",
                              "sequence-number": 3,
                              "summary": "Fraud service queries ML engine for risk assessment",
                              "direction": "source-to-destination"
                            },
                            {
                              "relationship-unique-id": "gateway-to-payment-processor",
                              "sequence-number": 4,
                              "summary": "Gateway forwards approved transaction to payment processor",
                              "direction": "source-to-destination"
                            },
                            {
                              "relationship-unique-id": "processor-to-bank-api",
                              "sequence-number": 5,
                              "summary": "Payment processor communicates with bank API",
                              "direction": "source-to-destination"
                            },
                            {
                              "relationship-unique-id": "gateway-to-audit-log",
                              "sequence-number": 6,
                              "summary": "Transaction details logged for compliance audit",
                              "direction": "source-to-destination"
                            }
                          ],
                          "controls": [
                            {
                              "control-id": "pci-dss-compliance",
                              "name": "PCI DSS Data Protection",
                              "description": "Ensures payment data is encrypted and handled per PCI DSS standards"
                            },
                            {
                              "control-id": "fraud-detection",
                              "name": "Real-time Fraud Detection",
                              "description": "ML-based fraud detection must approve all transactions"
                            }
                          ],
                          "metadata": [
                            {
                              "business-owner": "Payments Team",
                              "compliance-framework": "PCI DSS Level 1",
                              "sla-target": "< 3 seconds end-to-end",
                              "audit-frequency": "quarterly",
                              "last-reviewed": "2025-06-15",
                              "risk-level": "high"
                            }
                          ]
                        }
                        
                        ## 🔄 Data Synchronization Flow
                        {
                          "unique-id": "flow-data-sync",
                          "name": "Customer Data Synchronization",
                          "description": "Periodic synchronization of customer data between systems",
                          "transitions": [
                            {
                              "relationship-unique-id": "scheduler-to-sync-service",
                              "sequence-number": 1,
                              "summary": "Scheduler triggers data synchronization job",
                              "direction": "source-to-destination"
                            },
                            {
                              "relationship-unique-id": "sync-service-to-source-db",
                              "sequence-number": 2,
                              "summary": "Sync service queries source database for updated records",
                              "direction": "source-to-destination"
                            },
                            {
                              "relationship-unique-id": "sync-service-to-transform-engine",
                              "sequence-number": 3,
                              "summary": "Raw data sent to transformation engine for processing",
                              "direction": "source-to-destination"
                            },
                            {
                              "relationship-unique-id": "sync-service-to-target-db",
                              "sequence-number": 4,
                              "summary": "Transformed data written to target database",
                              "direction": "source-to-destination"
                            },
                            {
                              "relationship-unique-id": "sync-service-to-notification",
                              "sequence-number": 5,
                              "summary": "Sync completion status sent to notification service",
                              "direction": "source-to-destination"
                            }
                          ],
                          "metadata": [
                            {
                              "schedule": "daily at 2:00 AM UTC",
                              "data-volume": "~50,000 records per sync",
                              "duration-target": "< 30 minutes",
                              "failure-retry": "3 attempts with exponential backoff"
                            }
                          ]
                        }
                        
                        # Architecture with Multiple Flows
                        {
                          "$schema": "https://calm.finos.org/release/1.0-rc1/meta/calm.json",
                          "unique-id": "ecommerce-platform",
                          "name": "E-commerce Platform",
                          "description": "Multi-flow e-commerce architecture",
                          "flows": [
                            {
                              "unique-id": "flow-order-processing",
                              "name": "Order Processing Flow",
                              "description": "Customer order from cart to fulfillment",
                              "transitions": [
                                {
                                  "relationship-unique-id": "web-to-order-api",
                                  "sequence-number": 1,
                                  "summary": "Customer submits order via web interface"
                                },
                                {
                                  "relationship-unique-id": "order-api-to-inventory",
                                  "sequence-number": 2,
                                  "summary": "Order service checks inventory availability"
                                },
                                {
                                  "relationship-unique-id": "order-api-to-payment",
                                  "sequence-number": 3,
                                  "summary": "Order service processes payment"
                                },
                                {
                                  "relationship-unique-id": "order-api-to-fulfillment",
                                  "sequence-number": 4,
                                  "summary": "Confirmed order sent to fulfillment center"
                                }
                              ]
                            },
                            {
                              "unique-id": "flow-return-processing",
                              "name": "Return Processing Flow",
                              "description": "Customer return and refund process",
                              "transitions": [
                                {
                                  "relationship-unique-id": "web-to-return-api",
                                  "sequence-number": 1,
                                  "summary": "Customer initiates return request"
                                },
                                {
                                  "relationship-unique-id": "return-api-to-order-db",
                                  "sequence-number": 2,
                                  "summary": "Return service validates original order"
                                },
                                {
                                  "relationship-unique-id": "return-api-to-refund-service",
                                  "sequence-number": 3,
                                  "summary": "Approved return triggers refund processing"
                                }
                              ]
                            }
                          ]
                        }
                        """,
                """
                        Flows in CALM 1.0-rc1 describe business-level processes that traverse your technical architecture, providing traceability between business requirements and technical implementation.
                        
                        ## Key Characteristics:
                        • **Business Focus**: Flows represent business processes, not just technical data movement
                        • **Relationship Mapping**: Each transition must reference an existing relationship in your architecture
                        • **Sequential**: Transitions are ordered by sequence-number to show process flow
                        • **Directional**: Each transition specifies direction (source-to-destination or destination-to-source)
                        • **Traceable**: Links business requirements to technical components
                        
                        ## Required Properties:
                        • **unique-id**: Unique identifier for the flow
                        • **name**: Descriptive business name for the flow
                        • **description**: Detailed explanation of the flow's business purpose
                        • **transitions**: Array of at least one transition (the actual flow steps)
                        
                        ## Optional Properties:
                        • **requirement-url**: Link to detailed business requirements
                        • **controls**: Security, compliance, or governance controls applied to the flow
                        • **metadata**: Additional context (SLAs, business owners, compliance info, etc.)
                        
                        ## Transition Properties:
                        • **relationship-unique-id**: Must match an existing relationship in your architecture
                        • **sequence-number**: Integer indicating the order of this step in the flow
                        • **summary**: Business description of what happens in this transition
                        • **direction**: "source-to-destination" (default) or "destination-to-source"
                        
                        ## Common Flow Patterns:
                        • **User Journeys**: Login, registration, checkout, profile management
                        • **Business Processes**: Order processing, payment flows, approval workflows
                        • **Data Flows**: ETL processes, synchronization, reporting pipelines
                        • **Integration Flows**: API orchestration, event-driven processes
                        • **Compliance Flows**: Audit trails, regulatory reporting, data governance
                        
                        ## Best Practices:
                        • **Business Language**: Use business terminology in names and descriptions
                        • **Complete Flows**: Include all significant steps from start to finish
                        • **Relationship Validation**: Ensure all referenced relationships exist in your architecture
                        • **Logical Sequencing**: Use sequence numbers that allow for future insertions (10, 20, 30...)
                        • **Meaningful Summaries**: Each transition summary should explain the business value
                        • **Control Integration**: Add relevant security and compliance controls
                        • **Metadata Enrichment**: Include SLAs, business owners, and operational context
                        
                        ## Validation Rules:
                        • All relationship-unique-id values must reference existing relationships
                        • Sequence numbers should be unique within a flow
                        • At least one transition is required per flow
                        • Direction values must be valid enum values
                        • Controls and metadata follow their respective schema definitions
                        """
        );
    }
}
