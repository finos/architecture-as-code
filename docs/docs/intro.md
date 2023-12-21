---
sidebar_position: 1
slug: /
---

# Introduction

The **Architecture as Code** community publishes and maintains the **Common Architecture Language Model (CALM) Manifest** and related capabilities, which are tools built on top of the CALM framework to support System Architects in modelling and managing the architecture of a system. 

But more than that, our capabilities enable you to bring your architecture to life, by generating code and documentation and by providing tools to ensure that what you said you'd build is what you actually built. 

## Fast Track

Understand Architecture as Code in **5 minutes**:

### Keep CALM and Model Your Architecture

**CALM** is a collection of JSON Schemas that enable you to model your system architecture in a structured way. The core schema is very simple and consists of just 2 collections of elements **nodes** and **relationships**. 

```js showLineNumbers
{
  "nodes": [],
  "relationships": []
}
```

### Nodes 
**Nodes** tell us what the system is made of. 

```js showLineNumbers
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
  ]
}
```

You will notice that there is no structure applied in the **nodes** collection, it purely lists out anything you may consider drawing as a 'box' in a traditional architecture diagram. That includes people, systems, networks, services, databases, etc. which may be at different logical levels in your architecture.

Depending on the type of node the schema requires different attributes to be specified to ensure we have captured appropriate information about the node.

### Relationships
**Relationships** tell us how those things are connected.

```js showLineNumbers
{
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

It is the **relationships** which add the context and enable us to connect nodes or encapsulate one or more nodes within another. Depending on the type of relationship the schema requires different attributes to be set, as with the nodes, these additional details help us to enable the capabilities we build which make the model so useful.

Having such a simple core schema may seem limiting, but it's actually very powerful. Having no set hierarchy enforced by the structure of the schema means we can model arbitrarily complex systems and capture multiple views of the same system in a single model. This makes it a lot easier to model real world applications rather than idealised ones.

What you have seen here is just the beginning and shows you just the core schema which is deliberately kept simple. To see more about how you can make use of the **CALM** Manifest and it's supplementary domains see the [CALM](calm-core/) section.

### Capabilities

**Capabilities** are tools built on top of the CALM framework to support System Architects in modelling and managing the architecture of a system but also to provide the ability to bootstrap and extend you development work, perform drift detection and more.

We are just beginning to build the initial capabilities based on CALM so please come back soon to see what's happening or join the [DevOps Automation Mailing List](https://devops.finos.org/docs/home#mailing-list) to be sent notifations of new releases.
