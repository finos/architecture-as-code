package org.finos.calm.mcp.api;

import io.quarkiverse.mcp.server.Tool;

public class PatternCreationTool {

    @Tool(
            name = "patternCreationTool",
            description = "\u26A0 REQUIRED: Call this tool BEFORE creating any patterns in CALM"
    )
    public PatternCreationToolResponse patternCreationTool() {
        return new PatternCreationToolResponse(
                """
                        # \u26A0 CRITICAL: READ THIS FIRST BEFORE CREATING Patterns
                        
                        **YOU MUST CALL THIS TOOL BEFORE CREATING ANY Patterns**
                        Uses the full CALM Schema, but is itsels a schema
                        """,
                """
                        {
                          "$schema": "https://calm.finos.org/release/1.0-rc1/meta/calm.json",
                          "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/pattern/api-gateway",
                          "title": "API Gateway Pattern",
                          "type": "object",
                          "properties": {
                            "nodes": {
                              "type": "array",
                              "minItems": 4,
                              "prefixItems": [
                                {
                                  "$ref": "https://calm.finos.org/release/1.0-rc1/meta/core.json#/defs/node",
                                  "properties": {
                                    "well-known-endpoint": {
                                      "type": "string"
                                    },
                                    "description": {
                                      "const": "The API Gateway used to verify authorization and access to downstream system"
                                    },
                                    "node-type": {
                                      "const": "system"
                                    },
                                    "name": {
                                      "const": "API Gateway"
                                    },
                                    "unique-id": {
                                      "const": "api-gateway"
                                    },
                                    "interfaces": {
                                      "type": "array",
                                      "minItems": 1,
                                      "prefixItems": [
                                        {
                                          "$ref": "https://calm.finos.org/release/1.0-rc1/meta/interface.json#/defs/host-port-interface",
                                          "properties": {
                                            "unique-id": {
                                              "const": "api-gateway-ingress"
                                            }
                                          }
                                        }
                                      ]
                                    }
                                  },
                                  "required": [
                                    "well-known-endpoint",
                                    "interfaces"
                                  ]
                                },
                                {
                                  "$ref": "https://calm.finos.org/release/1.0-rc1/meta/core.json#/defs/node",
                                  "properties": {
                                    "description": {
                                      "const": "The API Consumer making an authenticated and authorized request"
                                    },
                                    "node-type": {
                                      "const": "system"
                                    },
                                    "name": {
                                      "const": "API Consumer"
                                    },
                                    "unique-id": {
                                      "const": "api-consumer"
                                    }
                                  }
                                },
                                {
                                  "$ref": "https://calm.finos.org/release/1.0-rc1/meta/core.json#/defs/node",
                                  "properties": {
                                    "description": {
                                      "const": "The API Producer serving content"
                                    },
                                    "node-type": {
                                      "const": "system"
                                    },
                                    "name": {
                                      "const": "API Producer"
                                    },
                                    "unique-id": {
                                      "const": "api-producer"
                                    },
                                    "interfaces": {
                                      "type": "array",
                                      "minItems": 1,
                                      "prefixItems": [
                                        {
                                          "$ref": "https://calm.finos.org/release/1.0-rc1/meta/interface.json#/defs/host-port-interface",
                                          "properties": {
                                            "unique-id": {
                                              "const": "producer-ingress"
                                            }
                                          }
                                        }
                                      ]
                                    }
                                  },
                                  "required": [
                                    "interfaces"
                                  ]
                                },
                                {
                                  "$ref": "https://calm.finos.org/release/1.0-rc1/meta/core.json#/defs/node",
                                  "properties": {
                                    "description": {
                                      "const": "The Identity Provider used to verify the bearer token"
                                    },
                                    "node-type": {
                                      "const": "system"
                                    },
                                    "name": {
                                      "const": "Identity Provider"
                                    },
                                    "unique-id": {
                                      "const": "idp"
                                    }
                                  }
                                }
                              ]
                            },
                            "relationships": {
                              "type": "array",
                              "minItems": 4,
                              "prefixItems": [
                                {
                                  "$ref": "https://calm.finos.org/release/1.0-rc1/meta/core.json#/defs/relationship",
                                  "properties": {
                                    "unique-id": {
                                      "const": "api-consumer-api-gateway"
                                    },
                                    "description": {
                                        "const": "Issue calculation request"
                                    },
                                    "relationship-type": {
                                      "const": {
                                        "connects": {
                                          "source": {
                                            "node": "api-consumer"
                                          },
                                          "destination": {
                                            "node": "api-gateway",
                                            "interfaces": [
                                              "api-gateway-ingress"
                                            ]
                                          }
                                        }
                                      }
                                    },
                                    "parties": {},
                                    "protocol": {
                                      "const": "HTTPS"
                                    },
                                    "authentication": {
                                      "const": "OAuth2"
                                    }
                                  }
                                },
                                {
                                  "$ref": "https://calm.finos.org/release/1.0-rc1/meta/core.json#/defs/relationship",
                                  "properties": {
                                    "unique-id": {
                                      "const": "api-gateway-idp"
                                    },
                                    "description": {
                                        "const": "Validate bearer token"
                                    },
                                    "relationship-type": {
                                      "const": {
                                        "connects": {
                                          "source": {
                                            "node": "api-gateway"
                                          },
                                          "destination": {
                                            "node": "idp"
                                          }
                                        }
                                      }
                                    },
                                    "protocol": {
                                      "const": "HTTPS"
                                    }
                                  }
                                },
                                {
                                  "$ref": "https://calm.finos.org/release/1.0-rc1/meta/core.json#/defs/relationship",
                                  "properties": {
                                    "unique-id": {
                                      "const": "api-gateway-api-producer"
                                    },
                                    "description": {
                                        "const": "Forward request"
                                    },
                                    "relationship-type": {
                                      "const": {
                                        "connects": {
                                          "source": {
                                            "node": "api-gateway"
                                          },
                                          "destination": {
                                            "node": "api-producer",
                                            "interfaces": [
                                              "producer-ingress"
                                            ]
                                          }
                                        }
                                      }
                                    },
                                    "protocol": {
                                      "const": "HTTPS"
                                    }
                                  }
                                },
                                {
                                    "$ref": "https://calm.finos.org/release/1.0-rc1/meta/core.json#/defs/relationship",
                                    "properties": {
                                      "unique-id": {
                                        "const": "api-consumer-idp"
                                      },
                                      "description": {
                                          "const": "Acquire a bearer token"
                                      },
                                      "relationship-type": {
                                        "const": {
                                          "connects": {
                                            "source": {
                                              "node": "api-consumer"
                                            },
                                            "destination": {
                                              "node": "idp"
                                            }
                                          }
                                        }
                                      },
                                      "protocol": {
                                        "const": "HTTPS"
                                      }
                                    }
                                  }
                              ]
                            }
                          },
                          "required": [
                            "nodes",
                            "relationships"
                          ]
                        }
                        """,
                  """
                        A pattern using the core calm schema as a base schema.
                        A pattern is a JSON Schema.
                        It will set values that cannot be changed as const values.
                        Values that can be changed will be declared/identified in the schema, but require the values to be added in the resulting architecture file.
                        Patterns can be based on other patterns, but only become complete once an architecture is generated.
                        So const for strong opinions and non const for options/user configurable pieces.
                        """
        );
    }
}
