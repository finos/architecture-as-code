---
id: direct-url-loading
title: Interacting with non-CALM Hub repository
sidebar_label: Direct URL loading
---

# Interacting with non-CALM Hub repository

For an organization that does not require the full functionality of CALM Hub and only needs the ability to store CALM artifacts in a central repository, the CLI's `DirectUrlDocumentLoader` lets `calm validate` and `calm generate` fetch architectures, patterns, and standards directly from any HTTP(S) endpoint — for example a static file server or an internal artifact repository — without going through CALM Hub.

Depending on the authentication/authorization requirements for the non-CALM Hub repositories the following configurations in `~/.calm.json` are supported:

- Public, anonymous access allowed:  
  - **`allowedRemoteHosts`** is an allow-list of hostnames the CLI is permitted to fetch documents.
- Requires authenticated access: 
  - **`directUrlAuthModule`**: Path to the local JavaScript authentication plugin used for protected direct URLs.
  - **`directUrlAuthConfigPath`**: Optional path passed to the plugin constructor for its own configuration.
  - **`directUrlAuthAuthenticatedHosts`**: List of hostnames that require authentication headers.

:::note
The `DirectUrlDocumentLoader` may access any host in the union of `allowedRemoteHosts` and `directUrlAuthAuthenticatedHosts`.
:::

::::note
The `directUrlAuth` plugin mechanism exists to let end user organizations implement their own authentication/authorization method based on HTTP(S) headers. Building, configuring, and securing that plugin is the sole responsibility of the end user organization. The JavaScript plugin module exports a `default class` implementing a `getAuthHeaders(url, requestBody)` function.

**The CALM project provides this mechanism and documentation as-is, with no warranty or support**. 

:::warning
The end user organization is solely responsible for security or correctness of the plugin implementation.
:::
::::

This plugin approach means the auth scheme is not fixed by the CLI itself — the end user supplied  module can implement anything from a hard-coded header, to OAuth2 client-credentials, to a secret pulled from a vault at request time.

[DirectUrlAuth Plugin](../working-with-calm/directurl-auth-plugin.mdx) page provides technical details for writing and configuring the plugin.
