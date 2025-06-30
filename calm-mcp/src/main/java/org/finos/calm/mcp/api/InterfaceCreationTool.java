package org.finos.calm.mcp.api;

import io.quarkiverse.mcp.server.Tool;

public class InterfaceCreationTool {

    public static class InterfaceCreationToolResponse {
        private final String schema;
        private final String example;
        private final String notes;

        public InterfaceCreationToolResponse(String schema, String example, String notes) {
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
            name = "interfaceCreationTool",
            description = "🚨 REQUIRED: Call this tool BEFORE creating any interfaces in CALM architecture documents. Provides critical schema validation rules and examples to ensure interfaces are created correctly and pass validation."
    )
    public InterfaceCreationToolResponse interfaceCreationTool() {
        return new InterfaceCreationToolResponse(
                """
                        # 🚨 CRITICAL: READ THIS FIRST BEFORE CREATING INTERFACES
                        
                        **YOU MUST CALL THIS TOOL BEFORE CREATING ANY INTERFACES IN CALM ARCHITECTURES**
                        
                        This tool provides essential validation rules that prevent schema errors.
                        Interfaces that don't follow these rules will fail validation with "oneOf" errors.
                        
                        ---
                        
                        # CALM Interface Schema (release/1.0-rc1)
                        
                        Interfaces define communication endpoints and protocols between nodes.
                        
                        ## 🚨 CRITICAL: oneOf Constraint
                        
                        Each interface MUST be exactly ONE of these two types:
                        
                        ```json
                        "interfaces": {
                          "type": "array",
                          "items": {
                            "oneOf": [
                              { "$ref": "interface.json#/defs/interface-definition" },
                              { "$ref": "interface.json#/defs/interface-type" }
                            ]
                          }
                        }
                        ```
                        
                        ⚠️ **You MUST choose exactly ONE approach per interface - never mix them!**
                        
                        ## Option 1: interface-definition (Modular - Recommended)
                        
                        **Required Properties:** unique-id, interface-definition-url, configuration
                        **Additional Properties:** false (no other properties allowed)
                        
                        ⚠️ **IMPORTANT**: The interface-definition-url must point to a valid, accessible schema file. 
                        For testing/examples, consider using built-in interface types instead.
                        
                        ```json
                        {
                          "unique-id": "string",
                          "interface-definition-url": "string", 
                          "configuration": {
                            // Object conforming to external schema
                          }
                        }
                        ```
                        
                        ## Option 2: interface-type (Built-in - Legacy)
                        
                        **Required Properties:** unique-id + specific type properties
                        **Must NOT have:** interface-definition-url or configuration
                        
                        ### Available Built-in Types:
                        
                        **host-port-interface:**
                        ```json
                        {
                          "unique-id": "string",
                          "host": "string",
                          "port": "integer"
                        }
                        ```
                        
                        **hostname-interface:**
                        ```json
                        {
                          "unique-id": "string", 
                          "hostname": "string"
                        }
                        ```
                        
                        **url-interface:**
                        ```json
                        {
                          "unique-id": "string",
                          "url": "string"
                        }
                        ```
                        
                        **oauth2-audience-interface:**
                        ```json
                        {
                          "unique-id": "string",
                          "audiences": ["string", "string"]
                        }
                        ```
                        
                        **container-image-interface:**
                        ```json
                        {
                          "unique-id": "string",
                          "image": "string"
                        }
                        ```
                        
                        **path-interface:**
                        ```json
                        {
                          "unique-id": "string",
                          "path": "string"
                        }
                        ```
                        
                        **port-interface:**
                        ```json
                        {
                          "unique-id": "string",
                          "port": "integer"
                        }
                        ```
                        
                        **rate-limit-interface:**
                        ```json
                        {
                          "unique-id": "string",
                          "key": {
                            "key-type": "User|IP|Header",
                            "static-value": "string"
                          },
                          "time": "integer",
                          "time-unit": "Seconds|Minutes|Hours",
                          "calls": "integer"
                        }
                        ```
                        """,
                """
                        # CALM Interface Examples
                        
                        ## ✅ CORRECT: Modular Interface Examples
                        
                        ### HTTP API Interface (Modular)
                        {
                          "unique-id": "http-api-interface",
                          "interface-definition-url": "https://example.com/schemas/http-service.json",
                          "configuration": {
                            "host": "api.internal.local",
                            "port": 8080,
                            "protocol": "HTTP",
                            "base-path": "/api/v1",
                            "content-type": "application/json",
                            "authentication": "Bearer token"
                          }
                        }
                        
                        ### gRPC Service Interface (Modular)
                        {
                          "unique-id": "grpc-service-interface", 
                          "interface-definition-url": "https://example.com/schemas/grpc-service.json",
                          "configuration": {
                            "service-name": "TradeService",
                            "host": "grpc.internal.local",
                            "port": 9090,
                            "proto-file": "trading.proto"
                          }
                        }
                        
                        ### Kafka Topic Interface (Modular)
                        {
                          "unique-id": "kafka-topic-interface",
                          "interface-definition-url": "https://example.com/schemas/kafka-topic.json", 
                          "configuration": {
                            "topic": "trade-events",
                            "host": "kafka.internal.local",
                            "port": 9092,
                            "consumer-group": "trade-processors"
                          }
                        }
                        
                        ## ✅ CORRECT: Built-in Interface Examples
                        
                        ### Database Connection (Host-Port)
                        {
                          "unique-id": "database-connection",
                          "host": "db.internal.local",
                          "port": 5432
                        }
                        
                        ### Web Frontend (Hostname)
                        {
                          "unique-id": "web-frontend",
                          "hostname": "app.example.com"
                        }
                        
                        ### External Webhook (URL)
                        {
                          "unique-id": "webhook-endpoint",
                          "url": "https://api.external.com/webhook/trades"
                        }
                        
                        ### OAuth2 Protected API (OAuth2 Audience)
                        {
                          "unique-id": "oauth-protected-api",
                          "audiences": [
                            "trading-api",
                            "settlement-service"
                          ]
                        }
                        
                        ### Container Service (Container Image)
                        {
                          "unique-id": "service-container",
                          "image": "trading-api:v2.3.1"
                        }
                        
                        ## ✅ CORRECT: Node with Multiple Interfaces
                        {
                          "unique-id": "trading-service",
                          "node-type": "service",
                          "name": "Trading Service",
                          "description": "Core trading API service",
                          "interfaces": [
                            {
                              "unique-id": "main-api",
                              "interface-definition-url": "https://example.com/schemas/http-service.json",
                              "configuration": {
                                "host": "api.internal.local",
                                "port": 8080,
                                "base-path": "/api/v1"
                              }
                            },
                            {
                              "unique-id": "health-check",
                              "host": "api.internal.local",
                              "port": 8081
                            },
                            {
                              "unique-id": "metrics-endpoint",
                              "hostname": "metrics.internal.local"
                            }
                          ]
                        }
                        
                        ## ❌ WRONG: Do NOT Mix Approaches
                        {
                          "unique-id": "bad-interface",
                          "interface-definition-url": "https://example.com/schemas/http-service.json",
                          "host": "api.local",
                          "port": 8080
                        }
                        """,
                """
                        # CALM Interface Creation Guidelines
                        
                        ## 🚨 CRITICAL: oneOf Validation Rules
                        
                        The CALM schema enforces a strict `oneOf` constraint for interfaces. Each interface must match EXACTLY ONE of these patterns:
                        
                        ### ✅ Valid: interface-definition (Modular)
                        - MUST have: unique-id, interface-definition-url, configuration
                        - MUST NOT have: host, port, hostname, url, audiences, image, path, key, time, calls, etc.
                        - additionalProperties: false (no extra properties allowed)
                        
                        ### ✅ Valid: interface-type (Built-in)
                        - MUST have: unique-id + specific type properties (host/port, hostname, url, etc.)
                        - MUST NOT have: interface-definition-url, configuration
                        - Only the properties defined for that specific interface type
                        
                        ### ❌ Invalid: Mixed Properties
                        - Having both interface-definition-url AND host/port
                        - Having configuration AND hostname
                        - Any combination of modular and built-in properties
                        
                        ## 📋 Interface Type Selection Guide
                        
                        ### Choose interface-definition When:
                        • You need complex protocol configuration (HTTP headers, authentication, etc.)
                        • You want to reference external interface schemas
                        • You need domain-specific protocols (gRPC, Kafka, GraphQL)
                        • You want standardization and reusability
                        • **You have valid, accessible schema URLs**
                        
                        ### Choose interface-type When:
                        • You have simple connection requirements (just host/port)
                        • You need basic endpoint references (URLs, hostnames)
                        • You want minimal configuration
                        • You're using legacy CALM patterns
                        • **You're creating examples or testing (avoids URL validation issues)**
                        
                        ## ✅ Validation Checklist
                        
                        **Before creating an interface, verify:**
                        
                        **For interface-definition:**
                        - [ ] Has unique-id (string)
                        - [ ] Has interface-definition-url (string)
                        - [ ] Has configuration (object)
                        - [ ] Does NOT have any built-in properties (host, port, hostname, url, etc.)
                        - [ ] No additional properties beyond these three
                        
                        **For interface-type:**
                        - [ ] Has unique-id (string)
                        - [ ] Has exactly the required properties for the specific type
                        - [ ] Does NOT have interface-definition-url
                        - [ ] Does NOT have configuration
                        - [ ] Properties match expected data types (string, integer, array)
                        
                        ## 🔧 Common Validation Errors
                        
                        **"must match exactly one schema in oneOf"** means:
                        • You mixed modular and built-in properties
                        • You're missing required properties for the chosen type
                        • You have extra properties not allowed for that type
                        • Property types don't match (e.g., port as string instead of integer)
                        
                        ## 🎯 Best Practices
                        
                        • **Be Explicit**: Choose one approach and stick to it
                        • **Validate Early**: Test your interfaces with the CALM CLI
                        • **Use Descriptive IDs**: Make unique-id values meaningful
                        • **Follow Conventions**: Use consistent naming patterns
                        • **Document Schemas**: For modular interfaces, document your external schemas
                        
                        ## ⚠️ Common Mistakes
                        
                        1. **Mixing Approaches**: Adding host/port to interface-definition
                        2. **Missing unique-id**: Every interface must have this property
                        3. **Wrong Data Types**: Using string for port instead of integer
                        4. **Extra Properties**: Adding properties not defined in the schema
                        5. **Empty Configuration**: Having configuration: {} without proper content
                        """
        );
    }
}
