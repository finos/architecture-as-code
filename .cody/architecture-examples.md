# CALM Architecture Examples (JSON – release/1.0-rc1)

This document shows how to structure CALM architecture files and illustrates both single-file and multi-file approaches using `detailed-architecture`.

---

## 📄 Example: Single-File Architecture Document

A complete architecture contained in one JSON file with nodes, relationships, and flows. No external links.

```json
{
  "unique-id": "arch-conference-secure-signup",
  "name": "Conference Secure Signup System",
  "description": "End-to-end architecture model for a secure user signup flow at a conference.",
  "nodes": [
    {
      "unique-id": "node-frontend",
      "node-type": "ui",
      "name": "Signup Web Frontend",
      "description": "Handles user signup via a secure UI.",
      "interfaces": [
        {
          "unique-id": "int-http-frontend",
          "hostname": "signup.conference.example.com"
        }
      ]
    },
    {
      "unique-id": "node-api",
      "node-type": "service",
      "name": "Signup API Service",
      "description": "Backend service validating user input and persisting accounts.",
      "interfaces": [
        {
          "unique-id": "int-rest-api",
          "interface-definition-url": "https://calm.finos.org/release/1.0-rc1/prototype/interfaces/http-service.json",
          "configuration": {
            "route": "/signup",
            "method": "POST"
          }
        }
      ]
    }
  ],
  "relationships": [
    {
      "unique-id": "rel-frontend-to-api",
      "description": "Secure HTTPS calls from frontend to API",
      "relationship-type": {
        "connects": {
          "source": { "node": "node-frontend" },
          "destination": { "node": "node-api" }
        }
      },
      "protocol": "HTTPS",
      "authentication": "OAuth2"
    }
  ],
  "flows": [
    {
      "unique-id": "flow-user-signup",
      "name": "User Signup Flow",
      "description": "Flow from UI input through API to database layer.",
      "transitions": [
        {
          "relationship-unique-id": "rel-frontend-to-api",
          "sequence-number": 1,
          "summary": "Frontend sends signup payload to API",
          "direction": "source-to-destination"
        }
      ]
    }
  ]
}
```

---

## 🔁 Example: Multi-File Architecture with `detailed-architecture` Link

This model separates concerns by linking to a more detailed architecture for a specific node.

```json
{
  "unique-id": "node-frontend",
  "node-type": "ui",
  "name": "Signup Web Frontend",
  "description": "Handles user signup via a secure UI.",
  "interfaces": [
    {
      "unique-id": "int-http-frontend",
      "hostname": "signup.conference.example.com"
    }
  ],
  "detailed-architecture": "conference-secure-signup-ui.arch.json"
}
```

The file `conference-secure-signup-ui.arch.json` would contain the full sub-architecture scoped to that node.
