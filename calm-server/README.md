# @finos/calm-server

A standalone HTTP server for the Common Architecture Language Model (CALM) validation functionality.

The `calm-server` executable provides HTTP endpoints for CALM architecture validation.

## Features

- **Bundled CALM Schemas** - All CALM schemas (release and draft) are bundled with the executable
- **Health Check Endpoint** (`GET /health`) - Status endpoint for monitoring
- **Validation Endpoint** (`POST /calm/validate`) - Validate CALM architectures against bundled schemas, or against an optional pattern supplied in the request

## Usage

### Starting the Server

```bash
# Basic usage (uses bundled schemas by default)
calm-server

# With custom port
calm-server --port 8080

# With verbose logging
calm-server --port 3000 --verbose

# Or provide a custom schema directory
calm-server -s /path/to/calm/schemas --port 3000
```

### Command-Line Options

```
Usage: calm-server [options]

Options:
  -V, --version                   output the version number
  --port <port>                   Port to run the server on (default: "3000")
  --host <host>                   Host to bind the server to (default: "127.0.0.1")
  -s, --schema-directory <path>   Path to the directory containing the meta schemas
                                  (default: bundled schemas in dist/calm)
  -v, --verbose                   Enable verbose logging (default: false)
  -c, --calm-hub-url <url>        URL to CALMHub instance
  --rate-limit-window <ms>        Rate limit window in milliseconds (default: 900000 = 15 minutes)
  --rate-limit-max <requests>     Max requests per IP within the rate limit window (default: 100)
  --allowed-remote-hosts <hosts>  Comma-separated trusted remote hosts allowed for $ref resolution
                                  in user-supplied patterns (default: calm.finos.org).
                                  Also configurable via CALM_ALLOWED_REMOTE_HOSTS.
  -h, --help                      display help for command
```

### Security Considerations

- **Default Host is Localhost**: By default, the server binds to `127.0.0.1` for security
- **No Built-in Authentication**: This server has no authentication or authorization controls
- **Network Exposure**: When binding to non-localhost addresses, a security warning is logged. Only expose to the network in trusted environments
- **User-Supplied Pattern `$ref`s**: When a `pattern` is supplied in the `/calm/validate` request, the server compiles it. To prevent arbitrary local-file reads and SSRF, `$ref`s in the supplied pattern are restricted to **local fragment references** (e.g. `#/defs/node`) and **absolute `https(s)` URLs**. Absolute filesystem paths (`/etc/...`, `C:\...`), relative paths, and `file://` URLs are rejected with a `400`. Remote hosts are further restricted to the `--allowed-remote-hosts` allowlist (default `calm.finos.org`)
- **Architecture `$schema` (no pattern supplied)**: when no pattern is provided, the `$schema` field is resolved through the document loader to locate the schema, so it must be an **absolute `http(s)` URL**. Local filesystem paths (absolute or relative) and `file://` URLs are rejected with a `400` to prevent arbitrary local-file reads. (When a pattern **is** supplied, `$schema` is only matched against the pattern's `$id` and is not resolved).

## API Endpoints

### Health Check

Check if the server is running:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "OK"
}
```

### Validate Architecture

Validate a CALM architecture document:

```bash
curl -X POST http://localhost:3000/calm/validate \
  -H "Content-Type: application/json" \
  -d '{
    "architecture": "{\"$schema\":\"https://calm.finos.org/release/1.2/meta/calm.json\",\"nodes\":[]}"
  }'
```

### Validate Architecture against a Pattern

Validate a CALM architecture against a runtime-supplied pattern by including an optional `pattern` field in the same `/calm/validate` request:

```bash
curl -X POST http://localhost:3000/calm/validate \
  -H "Content-Type: application/json" \
  -d @calm-server/test_fixtures/validation_route/valid_instantiation_with_pattern.json
```

> **Request requirements** (otherwise the endpoint responds with `400`):
> - Both `architecture` and `pattern` are sent as **JSON-encoded strings** inside the request body, and each must parse to a JSON **object**.
> - The architecture's `$schema` field must **exactly match** the pattern's `$id` field. If they differ, the request is rejected before validation runs.
> - `$ref`s in the supplied pattern must be local fragment references (`#/...`) or absolute `http(s)` URLs to allowed hosts (see [Security Considerations](#security-considerations)).

Response (success):
```json
{
  "jsonSchemaValidationOutputs":[],
  "spectralSchemaValidationOutputs":[],
  "hasErrors":false,
  "hasWarnings":false
}
```

Response (validation errors):
```json
{
  "jsonSchemaValidationOutputs":[],
  "spectralSchemaValidationOutputs":[...],
  "hasErrors":true,
  "hasWarnings":false
}
```

## Development

### Building

```bash
# From repository root
npm run build:calm-server

# Or from calm-server directory
cd calm-server
npm run build
```

### Testing

```bash
# From repository root
npm run test:calm-server

# Or from calm-server directory
cd calm-server
npm test

# With coverage
npm test -- --coverage
```

### Linting

```bash
# From calm-server directory
npm run lint
npm run lint-fix
```

## License

Apache-2.0

