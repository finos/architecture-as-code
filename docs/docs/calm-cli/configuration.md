---
id: configuration
title: Configuring the CLI
sidebar_label: Configuration
---

# Configuring the CLI

The CLI reads user configuration from `~/.calm.json`. Use this file to set your CALM Hub URL, the remote hosts the CLI can load documents from, and authentication plugins.

## Configuration Precedence

1. A command-line option, for example `--calm-hub-url`.
2. An environment variable.
3. `~/.calm.json`.

## Configuration Reference

| Property | Environment variable | Description |
|---|---|---|
| `calmHubUrl` | `CALM_HUB_URL` | The CALM Hub instance to use. When you set it, commands such as `validate` also load documents from CALM Hub |
| `allowedRemoteHosts` | `CALM_ALLOWED_REMOTE_HOSTS` | Hosts that the CLI can load documents from by direct URL. In the environment variable, use a comma-separated list |
| `authPluginPath` | `CALM_AUTH_PLUGIN_PATH` | Path to a CALM Hub [authentication plugin](#calm-hub-authentication-plugins) |
| `directUrlAuthModule` | `CALM_DIRECT_URL_AUTH_MODULE` | Path to the authentication module for protected direct URLs. See [Direct URL loading](direct-url-loading.md) |
| `directUrlAuthConfigPath` | `CALM_DIRECT_URL_AUTH_CONFIG_PATH` | Optional path that the CLI gives to the direct URL authentication module |
| `directUrlAuthAuthenticatedHosts` | `CALM_DIRECT_URL_AUTH_AUTHENTICATED_HOSTS` | Hosts that use the direct URL authentication module. In the environment variable, use a comma-separated list |

Example:

```json
{
  "calmHubUrl": "https://calmhub.example.com",
  "allowedRemoteHosts": ["calm.finos.org", "raw.githubusercontent.com"]
}
```

## Managing the File with `init-config`

Use `calm init-config` to create or update `~/.calm.json`. Do not edit the file by hand. The command keeps the values that are in the file and adds the values that you supply.

```shell
calm init-config \
  --calm-hub-url https://calmhub.example.com \
  --allowed-remote-hosts raw.githubusercontent.com,calm.finos.org \
  --auth-plugin-path /full/path/to/plugins/auth-plugin.js
```

### Command Options

- **`--calm-hub-url <url>`**: URL of the CALM Hub instance.
- **`--allowed-remote-hosts <hosts>`**: Comma-separated list of hosts that the CLI can load documents from by direct URL.
- **`--auth-plugin-path <path>`**: Path to the CALM Hub authentication plugin.
- **`--direct-url-auth-module <path>`**: Path to the direct URL authentication module.
- **`--direct-url-auth-config-path <path>`**: Path to the configuration file for the direct URL authentication module.
- **`--direct-url-auth-authenticated-hosts <hosts>`**: Comma-separated list of hosts that use the direct URL authentication module.

`--direct-url-auth-module` and `--direct-url-auth-authenticated-hosts` must be used together. You can add `--direct-url-auth-config-path` and more hosts the next time that you run `init-config`.

The two host-list options remove spaces and empty entries. They add the new hosts to the hosts that are in the file, with no duplicates. Other options replace the value in the file. The CLI does not check plugin and module paths until it uses them.

:::tip
Use full paths for plugins and modules. Relative paths resolve against the directory where you run the CLI.
:::

## CALM Hub Authentication Plugins

An authentication plugin adds headers to each request that the CLI sends to CALM Hub. Use it when your CALM Hub needs authentication, for example a bearer token from your identity provider.

A plugin is a JavaScript file that exports a default class. The class has a `getAuthHeaders(url, requestBody)` method that returns a `Promise<Record<string, string>>`:

```js
export default class MyAuthPlugin {
    async getAuthHeaders(url, requestBody) {
        const token = await getTokenFromMyIdentityProvider();
        return { Authorization: `Bearer ${token}` };
    }
}
```

The CLI calls `getAuthHeaders` with the URL and body of each request to CALM Hub. Set the path of the plugin in `authPluginPath`:

```json
{
  "calmHubUrl": "https://calmhub.example.com",
  "authPluginPath": "/full/path/to/plugins/auth-plugin.js"
}
```

:::note
`authPluginPath` applies only to CALM Hub requests. To authenticate documents that the CLI loads by direct URL, use a [direct URL authentication module](direct-url-loading.md).
:::
