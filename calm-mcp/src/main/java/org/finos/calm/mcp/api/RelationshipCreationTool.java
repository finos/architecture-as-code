package org.finos.calm.mcp.api;

import io.quarkiverse.mcp.server.Tool;

public class RelationshipCreationTool {

    public record RelationshipCreationToolResponse(String schema, String examples, String notes) {
    }

    @Tool(
            name = "relationshipCreationTool",
            description = "Provides details for creating a relationship"
    )
    public RelationshipCreationToolResponse relationshipCreationToolResponse() {
        return new RelationshipCreationToolResponse(
                """
                        "relationships": {
                              "type": "array",
                              "items": {
                                "$ref": "#/defs/relationship"
                              }
                        },
                        "relationship": {
                              "type": "object",
                              "properties": {
                                "unique-id": {
                                  "type": "string"
                                },
                                "description": {
                                  "type": "string"
                                },
                                "relationship-type": {
                                  "type": "object",
                                  "properties": {
                                    "interacts": {
                                      "$ref": "#/defs/interacts-type"
                                    },
                                    "connects": {
                                      "$ref": "#/defs/connects-type"
                                    },
                                    "deployed-in": {
                                      "$ref": "#/defs/deployed-in-type"
                                    },
                                    "composed-of": {
                                      "$ref": "#/defs/composed-of-type"
                                    },
                                    "options": {
                                      "$ref": "#/defs/option-type"
                                    }
                                  },
                                  "oneOf": [
                                    {
                                      "required": [
                                        "deployed-in"
                                      ]
                                    },
                                    {
                                      "required": [
                                        "composed-of"
                                      ]
                                    },
                                    {
                                      "required": [
                                        "interacts"
                                      ]
                                    },
                                    {
                                      "required": [
                                        "connects"
                                      ]
                                    },
                                    {
                                      "required": [
                                        "options"
                                      ]
                                    }
                                  ]
                                },
                                "protocol": {
                                  "$ref": "#/defs/protocol"
                                },
                                "metadata": {
                                  "$ref": "#/defs/metadata"
                                },
                                "controls": {
                                  "$ref": "control.json#/defs/controls"
                                }
                        },        
                        "protocol": {
                              "enum": [
                                "HTTP",
                                "HTTPS",
                                "FTP",
                                "SFTP",
                                "JDBC",
                                "WebSocket",
                                "SocketIO",
                                "LDAP",
                                "AMQP",
                                "TLS",
                                "mTLS",
                                "TCP"
                              ]
                        },       
                        """,
                        """
                        # Connects
                        {
                              "unique-id": "load-balancer-attendees",
                              "description": "Forward",
                              "protocol": "mTLS",
                              "relationship-type": {
                                "connects": {
                                  "source": {
                                    "node": "load-balancer"
                                  },
                                  "destination": {
                                    "node": "attendees"
                                  }
                                }
                              },
                            }
                        }
                        #Deployed In, Contains etc
                        {
                              "unique-id": "deployed-in-k8s-cluster",
                              "description": "Components deployed on the k8s cluster",
                              "relationship-type": {
                                "deployed-in": {
                                  "container": "k8s-cluster",
                                  "nodes": [
                                    "load-balancer",
                                    "attendees",
                                    "attendees-store"
                                  ]
                                }
                              }
                            }
                        }
                        """,
                """
                       Relationships are used to associate nodes together in some way.
                       There are several types of relationship.
                       They mostly fall into connecting two nodes 1:1.
                       They can also represent nodes that are in a same deployed in or contains relationship.
                       Nodes are referenced by their unique-id.
                       If a node has an interface, the relationship will indicate the interface it is using specifically, by unique-id.
                       An interface is typically only created on the receiving node.
                       """
        );

    }
}
