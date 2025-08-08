### Test Full Document

```json
{
  "nodes": [
    {
      "unique-id": "conference-website",
      "node-type": "webclient",
      "name": "Conference Website",
      "description": "Website to sign up for a conference",
      "interfaces": [
        {
          "unique-id": "conference-website-url",
          "url": "[[ URL ]]"
        }
      ]
    },
    {
      "unique-id": "load-balancer",
      "node-type": "network",
      "name": "Load Balancer",
      "description": "The attendees service, or a placeholder for another application",
      "interfaces": [
        {
          "unique-id": "load-balancer-host-port",
          "host": "[[ HOST ]]",
          "port": -1
        }
      ]
    },
    {
      "unique-id": "attendees",
      "node-type": "service",
      "name": "Attendees Service",
      "description": "The attendees service, or a placeholder for another application",
      "interfaces": [
        {
          "unique-id": "attendees-image",
          "image": "[[ IMAGE ]]"
        },
        {
          "unique-id": "attendees-port",
          "port": -1
        }
      ]
    },
    {
      "unique-id": "attendees-store",
      "node-type": "database",
      "name": "Attendees Store",
      "description": "Persistent storage for attendees",
      "interfaces": [
        {
          "unique-id": "database-image",
          "image": "[[ IMAGE ]]"
        },
        {
          "unique-id": "database-port",
          "port": -1
        }
      ]
    },
    {
      "unique-id": "k8s-cluster",
      "node-type": "system",
      "name": "Kubernetes Cluster",
      "description": "Kubernetes Cluster with network policy rules enabled",
      "controls": {
        "security": {
          "description": "Security requirements for the Kubernetes cluster",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/getting-started/controls/micro-segmentation.requirement.json",
              "$schema": "https://calm.finos.org/getting-started/controls/micro-segmentation.requirement.json",
              "$id": "https://calm.finos.org/getting-started/controls/micro-segmentation.config.json",
              "control-id": "security-001",
              "name": "Micro-segmentation of Kubernetes Cluster",
              "description": "Micro-segmentation in place to prevent lateral movement outside of permitted flows",
              "permit-ingress": true,
              "permit-egress": false
            }
          ]
        }
      }
    }
  ],
  "relationships": [
    {
      "unique-id": "conference-website-load-balancer",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "conference-website"
          },
          "destination": {
            "node": "load-balancer"
          }
        }
      },
      "controls": {
        "security": {
          "description": "Security Controls for the connection",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json",
              "$schema": "https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json",
              "control-id": "security-002",
              "name": "Permitted Connection",
              "description": "Permits a connection on a relationship specified in the architecture",
              "reason": "Required to enable flow between architecture components",
              "protocol": "HTTP"
            }
          ]
        }
      },
      "description": "Request attendee details",
      "protocol": "HTTPS"
    },
    {
      "unique-id": "load-balancer-attendees",
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
      "controls": {
        "security": {
          "description": "Security Controls for the connection",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json",
              "$schema": "https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json",
              "control-id": "security-002",
              "name": "Permitted Connection",
              "description": "Permits a connection on a relationship specified in the architecture",
              "reason": "Required to enable flow between architecture components",
              "protocol": "HTTP"
            }
          ]
        }
      },
      "description": "Forward",
      "protocol": "mTLS"
    },
    {
      "unique-id": "attendees-attendees-store",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "attendees"
          },
          "destination": {
            "node": "attendees-store"
          }
        }
      },
      "controls": {
        "security": {
          "description": "Security Controls for the connection",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json",
              "$schema": "https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json",
              "control-id": "security-003",
              "name": "Permitted Connection",
              "description": "Permits a connection on a relationship specified in the architecture",
              "reason": "Permitted to allow the connection between application and database",
              "protocol": "JDBC"
            }
          ]
        }
      },
      "description": "Store or request attendee details",
      "protocol": "JDBC"
    },
    {
      "unique-id": "deployed-in-k8s-cluster",
      "relationship-type": {
        "deployed-in": {
          "container": "k8s-cluster",
          "nodes": [
            "load-balancer",
            "attendees",
            "attendees-store"
          ]
        }
      },
      "description": "Components deployed on the k8s cluster"
    }
  ],
  "flows": [
    {
      "unique-id": "flow-conference-signup",
      "name": "Conference Signup Flow",
      "description": "Flow for registering a user through the conference website and storing their details in the attendee database.",
      "requirement-url": "",
      "transitions": [
        {
          "relationship-unique-id": "conference-website-load-balancer",
          "sequence-number": 1,
          "description": "User submits sign-up form via Conference Website to Load Balancer",
          "direction": "source-to-destination"
        },
        {
          "relationship-unique-id": "load-balancer-attendees",
          "sequence-number": 2,
          "description": "Load Balancer forwards request to Attendees Service",
          "direction": "source-to-destination"
        },
        {
          "relationship-unique-id": "attendees-attendees-store",
          "sequence-number": 3,
          "description": "Attendees Service stores attendee info in the Attendees Store",
          "direction": "source-to-destination"
        }
      ]
    }
  ],
  "metadata": {
    "kubernetes": {
      "namespace": "conference"
    }
  }
}
```



### Test Partial Document

```json
[
  {
    "unique-id": "conference-website",
    "node-type": "webclient",
    "name": "Conference Website",
    "description": "Website to sign up for a conference",
    "interfaces": [
      {
        "unique-id": "conference-website-url",
        "url": "[[ URL ]]"
      }
    ]
  },
  {
    "unique-id": "load-balancer",
    "node-type": "network",
    "name": "Load Balancer",
    "description": "The attendees service, or a placeholder for another application",
    "interfaces": [
      {
        "unique-id": "load-balancer-host-port",
        "host": "[[ HOST ]]",
        "port": -1
      }
    ]
  },
  {
    "unique-id": "attendees",
    "node-type": "service",
    "name": "Attendees Service",
    "description": "The attendees service, or a placeholder for another application",
    "interfaces": [
      {
        "unique-id": "attendees-image",
        "image": "[[ IMAGE ]]"
      },
      {
        "unique-id": "attendees-port",
        "port": -1
      }
    ]
  },
  {
    "unique-id": "attendees-store",
    "node-type": "database",
    "name": "Attendees Store",
    "description": "Persistent storage for attendees",
    "interfaces": [
      {
        "unique-id": "database-image",
        "image": "[[ IMAGE ]]"
      },
      {
        "unique-id": "database-port",
        "port": -1
      }
    ]
  },
  {
    "unique-id": "k8s-cluster",
    "node-type": "system",
    "name": "Kubernetes Cluster",
    "description": "Kubernetes Cluster with network policy rules enabled",
    "controls": {
      "security": {
        "description": "Security requirements for the Kubernetes cluster",
        "requirements": [
          {
            "requirement-url": "https://calm.finos.org/getting-started/controls/micro-segmentation.requirement.json",
            "$schema": "https://calm.finos.org/getting-started/controls/micro-segmentation.requirement.json",
            "$id": "https://calm.finos.org/getting-started/controls/micro-segmentation.config.json",
            "control-id": "security-001",
            "name": "Micro-segmentation of Kubernetes Cluster",
            "description": "Micro-segmentation in place to prevent lateral movement outside of permitted flows",
            "permit-ingress": true,
            "permit-egress": false
          }
        ]
      }
    }
  }
]
```