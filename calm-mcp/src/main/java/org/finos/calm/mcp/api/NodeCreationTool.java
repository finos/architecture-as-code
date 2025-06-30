package org.finos.calm.mcp.api;

import io.quarkiverse.mcp.server.Tool;

public class NodeCreationTool {

    public record NodeCreationToolResponse(String schema, String example, String notes) {
    }

    @Tool(
            name = "nodeCreationTool",
            description = "Provides details for creating a node"
    )
    public NodeCreationToolResponse nodeCreationTool() {
        return new NodeCreationToolResponse(
                """
                         "nodes": {
                              "type": "array",
                              "items": {
                                "$ref": "#/defs/node"
                              }
                            },
                             "defs": {
                                "node": {
                                  "type": "object",
                                  "properties": {
                                    "unique-id": {
                                      "type": "string"
                                    },
                                    "node-type": {
                                      "$ref": "#/defs/node-type-definition"
                                    },
                                    "name": {
                                      "type": "string"
                                    },
                                    "description": {
                                      "type": "string"
                                    },
                                    "details": {
                                      "type": "object",
                                      "properties": {
                                        "detailed-architecture": {
                                          "type": "string"
                                        },
                                        "required-pattern": {
                                          "type": "string"
                                        }
                                      },
                                      "additionalProperties": false
                                    },
                                    "data-classification": {
                                      "$ref": "#/defs/data-classification"
                                    },
                                    "run-as": {
                                      "type": "string"
                                    },
                                    "interfaces": {
                                      "type": "array",
                                      "items": {
                                        "oneOf": [
                                          { "$ref": "interface.json#/defs/interface-definition" },
                                          { "$ref": "interface.json#/defs/interface-type" }
                                        ]
                                      }
                                    },
                                    "controls": {
                                      "$ref": "control.json#/defs/controls"
                                    },
                                    "metadata": {
                                      "$ref": "#/defs/metadata"
                                    }
                                  },
                                  "required": [
                                    "unique-id",
                                    "node-type",
                                    "name",
                                    "description"
                                  ],
                                  "additionalProperties": true
                               },
                               "node-type-definition": {
                                     "anyOf": [
                                       {
                                         "enum": [
                                           "actor",
                                           "ecosystem",
                                           "system",
                                           "service",
                                           "database",
                                           "network",
                                           "ldap",
                                           "webclient",
                                           "data-asset"
                                         ]
                                       },
                               },
                               "data-classification": {
                                     "enum": [
                                       "Public",
                                       "Confidential",
                                       "Highly Restricted",
                                       "MNPI",
                                       "PII"
                                     ]
                               },
                               # From Interface
                               "$schema": "https://json-schema.org/draft/2020-12/schema",
                                 "$id": "https://calm.finos.org/release/1.0-rc1/meta/interface.json",
                                 "title": "Common Architecture Language Model Interfaces",
                                 "defs": {
                                   "interface-definition": {
                                     "type": "object",
                                     "description": "A modular interface definition referencing an external schema",
                                     "properties": {
                                       "unique-id": {
                                         "type": "string",
                                         "description": "Unique identifier for this interface instance"
                                       },
                                       "interface-definition-url": {
                                         "type": "string",
                                         "description": "URI of the external schema this interface configuration conforms to"
                                       },
                                       "configuration": {
                                         "type": "object",
                                         "description": "Inline configuration conforming to the external interface schema"
                                       }
                                     },
                                     "required": ["unique-id", "interface-definition-url", "configuration"],
                                     "additionalProperties": false
                                   },
                                   "interface-type": {
                                     "type": "object",
                                     "properties": {
                                       "unique-id": {
                                         "type": "string"
                                       }
                                     },
                                     "required": [
                                       "unique-id"
                                     ]
                                   },
                                   "node-interface": {
                                     "type": "object",
                                     "properties": {
                                       "node": {
                                         "type": "string"
                                       },
                                       "interfaces": {
                                         "type": "array",
                                         "items": {
                                           "type": "string"
                                         }
                                       }
                                     },
                                     "required": [
                                       "node"
                                     ]
                                   },
                        
                        """,
                """
                        {
                              "unique-id": "conference-website",
                              "name": "Conference Website",
                              "description": "Website to sign up for a conference",
                              "node-type": "webclient",
                              "interfaces": [
                                {
                                  "unique-id": "conference-website-url",
                                  "url": "https://calm.finos.org/amazing-website"
                                }
                              ]
                            },
                        """,
                  """
                        A node is a box in an architecture. It represents a variety of different possible architecture building blocks.
                        At the very top level it is a unique-id, name, description, and a node-type.
                        Beyond that is can optionally contain interfaces, defining the possible ways in which relationships can interact with a node.
                        There is also the option to add controls, which are typically non-functional requirements.
                        When creating interfaces on a node, they are typically on created on the receiving node of the relationship.
                        """
        );
    }
}
