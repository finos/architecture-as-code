package org.finos.calm.mcp.api;

import io.quarkiverse.mcp.server.Tool;

public class MetadataCreationTool {

    public static class MetadataCreationToolResponse {
        private final String schema;
        private final String example;
        private final String notes;

        public MetadataCreationToolResponse(String schema, String example, String notes) {
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
            name = "metadataCreationTool",
            description = "🚨 REQUIRED: Call this tool BEFORE adding metadata to any CALM architecture elements (architecture, nodes, relationships, flows). Provides critical schema validation rules - metadata MUST always be arrays, never objects."
    )
    public MetadataCreationToolResponse metadataCreationTool() {
        return new MetadataCreationToolResponse(
                """
                        # 🚨 CRITICAL: READ THIS FIRST BEFORE CREATING METADATA
                        
                        **YOU MUST CALL THIS TOOL BEFORE ADDING METADATA TO ANY CALM ELEMENTS**
                        
                        This tool provides essential validation rules that prevent schema errors.
                        Metadata that isn't an array will fail validation with "must be array" errors.
                        
                        ---
                        
                        # CALM Metadata Schema (release/1.0-rc1)
                        
                        ## 🚨 CRITICAL: Metadata is ALWAYS an Array
                        
                        ```json
                        "metadata": {
                          "type": "array",
                          "items": {
                            "type": "object"
                          }
                        }
                        ```
                        
                        ⚠️ **IMPORTANT: Metadata must ALWAYS be an array of objects, never a single object!**
                        
                        ## ✅ CORRECT Format (Array of Objects):
                        ```json
                        "metadata": [
                          {
                            "key": "value",
                            "another-key": "another-value"
                          }
                        ]
                        ```
                        
                        ## ❌ WRONG Format (Single Object):
                        ```json
                        "metadata": {
                          "key": "value",
                          "another-key": "another-value"
                        }
                        ```
                        
                        # Metadata Usage in CALM Constructs:
                        
                        ## 1. Architecture-level metadata (top-level)
                        ```json
                        {
                          "$schema": "https://calm.finos.org/release/1.0-rc1/meta/calm.json",
                          "name": "My Architecture",
                          "metadata": [
                            {
                              "version": "1.0.0",
                              "created-by": "Architecture Team",
                              "environment": "production"
                            }
                          ]
                        }
                        ```
                        
                        ## 2. Node-level metadata
                        ```json
                        "nodes": [
                          {
                            "unique-id": "node-example",
                            "node-type": "service",
                            "name": "Example Service",
                            "description": "Example service description",
                            "metadata": [
                              {
                                "version": "2.3.1",
                                "owner": "Platform Team",
                                "deployed-on": "Kubernetes"
                              }
                            ]
                          }
                        ]
                        ```
                        
                        ## 3. Relationship-level metadata
                        ```json
                        "relationships": [
                          {
                            "unique-id": "rel-example",
                            "description": "Example relationship",
                            "relationship-type": {
                              "connects": {
                                "source": { "node": "source-node" },
                                "destination": { "node": "dest-node" }
                              }
                            },
                            "metadata": [
                              {
                                "protocol": "HTTPS",
                                "authentication": "Bearer Token",
                                "rate-limit": "100/minute"
                              }
                            ]
                          }
                        ]
                        ```
                        
                        ## 4. Flow-level metadata
                        ```json
                        "flows": [
                          {
                            "unique-id": "flow-example",
                            "description": "Example flow",
                            "metadata": [
                              {
                                "business-process": "Order Processing",
                                "sla": "99.9% uptime",
                                "compliance": "PCI-DSS"
                              }
                            ]
                          }
                        ]
                        ```
                        """,
                """
                        # Architecture-level metadata example
                        {
                          "$schema": "https://calm.finos.org/release/1.0-rc1/meta/calm.json",
                          "unique-id": "arch-trading-platform",
                          "name": "Trading Platform Architecture",
                          "description": "Core trading system architecture",
                          "metadata": [
                            {
                              "version": "3.1.0",
                              "environment": "production",
                              "compliance": "SOX, FINRA",
                              "last-reviewed": "2025-06-15",
                              "business-owner": "Trading Operations",
                              "technical-owner": "Platform Engineering",
                              "deployment-region": "us-east-1",
                              "criticality": "high"
                            }
                          ],
                          "nodes": [
                            {
                              "unique-id": "trading-api",
                              "node-type": "service",
                              "name": "Trading API Service",
                              "description": "Core API for trade processing",
                              "metadata": [
                                {
                                  "version": "2.3.1",
                                  "owner": "API Team",
                                  "runtime": "Java 17",
                                  "framework": "Spring Boot",
                                  "deployed-on": "Kubernetes",
                                  "replicas": 3,
                                  "cpu-limit": "2000m",
                                  "memory-limit": "4Gi",
                                  "health-check": "/actuator/health",
                                  "monitoring": "Prometheus + Grafana",
                                  "logging": "ELK Stack",
                                  "last-deployed": "2025-06-20T14:30:00Z"
                                }
                              ]
                            }
                          ],
                          "relationships": [
                            {
                              "unique-id": "api-to-database",
                              "description": "Trading API connects to database",
                              "relationship-type": {
                                "connects": {
                                  "source": { "node": "trading-api" },
                                  "destination": { "node": "trade-database" }
                                }
                              },
                              "protocol": "JDBC",
                              "metadata": [
                                {
                                  "connection-pool-size": 20,
                                  "timeout": "30s",
                                  "encryption": "TLS 1.3",
                                  "authentication": "certificate-based",
                                  "monitoring": "connection-pool-metrics",
                                  "backup-strategy": "daily-snapshots",
                                  "disaster-recovery": "cross-region-replication"
                                }
                              ]
                            }
                          ]
                        }
                        """,
                """
                        # CALM Metadata Guidelines
                        
                        ## 🚨 CRITICAL REQUIREMENT: Always Use Arrays
                        
                        Metadata in CALM 1.0-rc1 is **ALWAYS** defined as an array of objects. This is a strict schema requirement that cannot be violated.
                        
                        ### ✅ CORRECT: Array Format
                        ```json
                        "metadata": [
                          {
                            "version": "1.0.0",
                            "owner": "Platform Team"
                          }
                        ]
                        ```
                        
                        ### ❌ WRONG: Object Format
                        ```json
                        "metadata": {
                          "version": "1.0.0",
                          "owner": "Platform Team"
                        }
                        ```
                        
                        ## Key Characteristics:
                        • **Schema**: Array of objects with no predefined structure
                        • **Flexibility**: Can contain any key-value pairs relevant to your architecture
                        • **Scope**: Available at architecture, node, relationship, and flow levels
                        • **Purpose**: Enrich models with operational, compliance, and business context
                        • **Validation**: Must always be an array, even for single metadata objects
                        
                        ## Common Use Cases:
                        • **Operational**: versions, owners, deployment info, resource limits, health checks
                        • **Compliance**: regulatory requirements, audit dates, certifications, data classification
                        • **Business**: SLAs, business owners, criticality levels, cost centers
                        • **Technical**: frameworks, runtimes, monitoring, infrastructure details
                        • **Deployment**: environments, scaling info, networking, container details
                        
                        ## Validation Rules:
                        1. **Always use array syntax**: `"metadata": [...]` never `"metadata": {...}`
                        2. **Objects within arrays**: Each array item must be an object `{}`
                        3. **Flexible content**: No restrictions on object properties or structure
                        4. **Multiple objects allowed**: Can have multiple metadata objects in the array
                        5. **Empty arrays allowed**: `"metadata": []` is valid if no metadata needed
                        
                        ## Best Practices:
                        • Use consistent naming conventions across your organization
                        • Include timestamps in ISO 8601 format for date/time values
                        • Group related metadata logically within single objects
                        • Consider tooling that can consume and validate your metadata structure
                        • Use metadata to drive automation, monitoring, and compliance reporting
                        • Always validate your CALM documents against the schema
                        """
        );
    }
}
