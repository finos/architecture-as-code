---
sidebar_position: 1
slug: /
---

# Introduction

The **Architecture as Code** community publishes and maintains the **Common Architecture Language Model (CALM)** and related capabilities, which are tools built on top of the CALM framework to support System Architects in modelling and managing the architecture of a system. 

But more than that, our capabilities enable you to bring your architecture to life, by generating code and documentation and by providing tools to ensure that what you said you'd build is what you actually built. 

## Fast Track

Understand Architecture as Code in **5 minutes**:

### The CALM Manifest

The CALM Manifest is a JSON Schema that enables you to model your system architecture in a structured way. The core schema is very simple and consists of just 2 collections of elements **nodes** and **relationships**. 

```js
{
  "nodes": [],
  "relationships": []
}
```

**Nodes** tell us what the system is made of, and **relationships** tell us how those things are connected. 

```js
{
  "nodes": [
    {
      "uniqueId": "web-client",
      "type": "webclient",
      "name": "Web  Client",
      "description": "Browser based web interface",
      "data-classification": "Confidential",
      "run-as": "user"
    },
    {
      "uniqueId": "some-service",
      "type": "service",
      "name": "An Important Service",
      "description": "Server process which does something fascinating",
      "data-classification": "Confidential",
      "run-as": "systemId"
    }
  ],
  "relationships": [
    {
      "uniqueId": "web-client-uses-some-service",
      "type": "connects",
      "parties": {
        "source": "web-client",
        "destination": "some-service"
      },
      "protocol": "HTTPS",
      "authentication": "OAuth2"
    }
  ]
}
```

Having such a simple core schema may seem limiting, but it's actually very powerful. Having no set hierarchy enforced by the structure of the schema means we can model arbitrarily complex systems and capture multiple views of the same system in a single model.

What you have seen here is just the beginning and shows you just the core schema which is deliberately kept simple. As we start to think about specific domains of architecture we have additional **domain schemas** which enable us to capture additional detail and support the implementation of our key capabilities.

### Capabilities

**Capabilities** are tools built on top of the CALM framework to support System Architects in modelling and managing the architecture of a system but also to provide the ability to bootstrap and extend you development work, perform drift detection and more.
