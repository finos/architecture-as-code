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
            description = "Provides details for creating metadata in CALM architecture documents"
    )
    public MetadataCreationToolResponse metadataCreationTool() {
        return new MetadataCreationToolResponse(
                """
                        "metadata": {
                          "type": "array",
                          "items": {
                            "type": "object"
                          }
                        }
                        
                        # Metadata can be used in multiple CALM constructs:
                        
                        ## 1. Architecture-level metadata (top-level)
                        "metadata": [
                          {
                            "key": "value",
                            "another-key": "another-value"
                          }
                        ]
                        
                        ## 2. Node-level metadata
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
                        
                        ## 3. Relationship-level metadata
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
                                "bandwidth": "1Gbps",
                                "encryption": "TLSv1.3",
                                "last-tested": "2025-06-30"
                              }
                            ]
                          }
                        ]
                        
                        ## 4. Flow-level metadata (in flow.json schema)
                        "flows": [
                          {
                            "unique-id": "flow-example",
                            "name": "Example Flow",
                            "description": "Example flow description",
                            "transitions": [...],
                            "metadata": [
                              {
                                "business-owner": "Operations Team",
                                "sla": "2 seconds",
                                "last-audited": "2025-06-12"
                              }
                            ]
                          }
                        ]
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
                        Metadata in CALM 1.0-rc1 is defined as an array of objects, providing flexible key-value storage for enriching architecture models.
                        
                        Key characteristics:
                        • Schema: Array of objects with no predefined structure
                        • Flexibility: Can contain any key-value pairs relevant to your architecture
                        • Scope: Available at architecture, node, relationship, and flow levels
                        • Purpose: Enrich models with operational, compliance, and business context
                        
                        Common metadata use cases:
                        • Operational data: versions, owners, deployment info, resource limits
                        • Compliance: regulatory requirements, audit dates, certifications
                        • Business context: SLAs, business owners, criticality levels
                        • Technical details: frameworks, runtimes, monitoring, health checks
                        • Infrastructure: deployment targets, scaling info, networking details
                        
                        Best practices:
                        • Use consistent naming conventions across your organization
                        • Include timestamps in ISO 8601 format for date/time values
                        • Group related metadata logically within single objects
                        • Consider tooling that can consume and validate your metadata structure
                        • Use metadata to drive automation, monitoring, and compliance reporting
                        """
        );
    }
}
