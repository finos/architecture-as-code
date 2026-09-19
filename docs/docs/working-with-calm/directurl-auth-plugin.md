---
id: directurl-auth-plugin
title: DirectUrlAuth Plugin Testing
---

<!-- TODO: expand this placeholder with the full write-up. -->

```mermaid
graph TB
    subgraph ORG["Organisation (private)"]
        subgraph CALM_CLI["calm cli run-time"]
            SHARED["@finos/calm-shared"]
            CLI["@finos/calm-cli"]
        end

        subgraph INHOUSE["git repo: Local org integration"]
            ORG_SRC["src/acme-inhouse-idp-client.ts\nimplements IdpClient"]
            ORG_AUTH["built acme-inhouse-idp-client"]
        end

        ORG_SRC -- "npm install / npm build" --> ORG_AUTH
        ORG_AUTH -- "via configuration directUrlAuth.module integrate with" --> CLI
    end


    style INHOUSE fill:#e8f0fb,stroke:#3a6bc4
    style ORG fill:#f0f4ff,stroke:#3a6bc4

```


This page walks through a local test environment for the CALM CLI's `directUrlAuth` plugin, focused on the `start-webserver-mixedenv` setup.

## Test Environment Setup

<!-- TODO: describe the start-webserver-mixedenv test environment. -->

## CALM Architecture

<!-- TODO: link to the CALM architecture for this setup. -->

[CALM Architecture]()

## Sample Code

<!-- TODO: link to the directUrlAuth plugin sample source code. -->

[Sample Code]()

## Testing Instructions

<!-- TODO: fill in the steps for using this setup to test the directUrlAuth plugin. -->

1. TODO
2. TODO
3. TODO
