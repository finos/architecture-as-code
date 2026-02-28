---
id: validation-server
title: Validation Server
sidebar_position: 5
---

# Validation Server

The `@finos/calm-server` package provides a standalone HTTP server for CALM architecture validation. It exposes REST API endpoints that allow you to validate CALM architectures remotely. This makes it ideal to include in application containers to provide CALM validation capability, without requiring subprocess invocations.

The separation from the `@finos/calm-cli` package may also allow organizations to control the server availability.

## Overview

While the CLI provides command-line validation, the validation server enables remote validation via HTTP requests.

All CALM schemas (release and draft versions) are bundled with the server, so no additional schema files are required.

## Installation

Install the validation server globally:

```bash
npm install -g @finos/calm-server
```

Or use it within a project:

```bash
npm install --save-dev @finos/calm-server
```

## Starting the Server

### Basic Usage

Start the server with default settings (listens on `localhost:3000`):

```bash
calm-server
```

The server will start and display:
```
CALM Server is running on http://127.0.0.1:3000
```

### With Custom Port

```bash
calm-server --port 8080
```

### With Verbose Logging

```bash
calm-server --verbose
```

### With Custom Schema Directory

By default, the server uses bundled CALM schemas. To use custom schemas:

```bash
calm-server --schema-directory /path/to/calm/schemas
```

## Command-Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `-V, --version` | Output the version number | - |
| `--port <port>` | Port to run the server on | `3000` |
| `--host <host>` | Host to bind the server to | `127.0.0.1` |
| `-s, --schema-directory <path>` | Path to custom CALM schema files | Bundled schemas |
| `-v, --verbose` | Enable verbose logging | `false` |
| `-c, --calm-hub-url <url>` | URL to CALMHub instance for remote schema resolution | - |
| `--rate-limit-window <ms>` | Rate limit window in milliseconds | `900000` (15 min) |
| `--rate-limit-max <requests>` | Max requests per IP within rate limit window | `100` |
| `-h, --help` | Display help information | - |

## API Endpoints

### Health Check

Check if the server is running and responsive.

**Endpoint:** `GET /health`

**Example:**

```bash
curl http://localhost:3000/health
```

**Response:**

```json
{
  "status": "OK"
}
```

### Validate Architecture

Validate a CALM architecture document against the appropriate schema.

**Endpoint:** `POST /calm/validate`

**Headers:**
- `Content-Type: application/json`

**Request Body:**

```json
{
  "architecture": "{\"$schema\":\"https://calm.finos.org/release/1.2/meta/calm.json\",\"nodes\":[]}"
}
```

The `architecture` field should contain a **stringified JSON** representation of your CALM architecture.

**Example Request:**

```bash
curl -X POST http://localhost:3000/calm/validate \
  -H "Content-Type: application/json" \
  -d '{
    "architecture": "{\"$schema\":\"https://calm.finos.org/release/1.2/meta/calm.json\",\"nodes\":[],\"relationships\":[]}"
  }'
```

**Response (Valid Architecture):**

```json
{
  "jsonSchemaValidationOutputs": [],
  "spectralSchemaValidationOutputs": [],
  "hasErrors": false,
  "hasWarnings": false
}
```

**Response (Invalid Architecture):**

```json
{
  "jsonSchemaValidationOutputs": [
    {
      "valid": false,
      "errors": [
        {
          "instancePath": "/nodes/0",
          "schemaPath": "#/properties/nodes/items/required",
          "keyword": "required",
          "params": { "missingProperty": "unique-id" },
          "message": "must have required property 'unique-id'"
        }
      ]
    }
  ],
  "spectralSchemaValidationOutputs": [],
  "hasErrors": true,
  "hasWarnings": false
}
```

## Security Considerations

:::warning
The validation server has **no built-in authentication or authorization**. It is designed for use in trusted environments.
:::

### Default Security Settings

- **Localhost Binding**: By default, the server binds to `127.0.0.1`, making it accessible only from the local machine
- **Rate Limiting**: Enabled by default (100 requests per 15 minutes per IP)
- **Security Warning**: When binding to non-localhost addresses, a warning is logged

### Network Exposure

When exposing the server to a network (using `--host 0.0.0.0` or a specific IP):

```bash
calm-server --host 0.0.0.0 --port 3000
```

The server will log:
```
⚠️  WARNING: Server is configured to listen on 0.0.0.0
⚠️  This server has NO authentication or authorization controls.
⚠️  Only bind to non-localhost addresses in trusted network environments.
```

**Best Practices:**
- Use a reverse proxy (nginx, Apache) with authentication
- Deploy behind a VPN or firewall
- Use network-level access controls
- Monitor usage and logs

## Use Cases

### Web Application Integration

Use the validation server as a backend for web-based CALM editors:

```javascript
async function validateArchitecture(architectureJson) {
  const response = await fetch('http://localhost:3000/calm/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      architecture: JSON.stringify(architectureJson)
    })
  });
  
  const result = await response.json();
  
  if (result.hasErrors) {
    console.error('Validation errors:', result.jsonSchemaValidationOutputs);
  }
  
  return result;
}
```

### Docker Deployment

Create a Dockerfile for containerized deployment:

```dockerfile
FROM node:22-alpine

RUN npm install -g @finos/calm-server

EXPOSE 3000

CMD ["calm-server", "--host", "0.0.0.0", "--port", "3000"]
```

Build and run:

```bash
docker build -t calm-server .
docker run -p 3000:3000 calm-server
```

## Rate Limiting

The server includes built-in rate limiting to prevent abuse:

- **Default Window**: 15 minutes (900,000 ms)
- **Default Max Requests**: 100 per IP address

### Customizing Rate Limits

Adjust rate limits based on your use case:

```bash
# Higher limits for internal team usage
calm-server \
  --rate-limit-window 3600000 \
  --rate-limit-max 1000

# Stricter limits for public-facing instances
calm-server \
  --rate-limit-window 600000 \
  --rate-limit-max 50
```

### Rate Limit Response

When rate limits are exceeded, the server returns:

**HTTP 429 Too Many Requests**

```html
Too many requests, please try again later.
```

## Troubleshooting

### Server Won't Start

**Problem**: Port already in use

```
Error: listen EADDRINUSE: address already in use 127.0.0.1:3000
```

**Solution**: Use a different port or stop the process using port 3000:

```bash
# Use different port
calm-server --port 8080

# Or find and stop the process
lsof -i :3000
kill -9 <PID>
```

### Validation Fails with Valid Architecture

**Problem**: Architecture validates with CLI but fails with server

**Solution**: Ensure the architecture is properly stringified in the request body:

```javascript
// Correct: Stringified JSON
{
  "architecture": "{\"$schema\":\"...\",\"nodes\":[]}"
}

// Incorrect: Plain JSON object
{
  "architecture": {"$schema": "...", "nodes": []}
}
```

### Connection Refused

**Problem**: Cannot connect to server

```
curl: (7) Failed to connect to localhost port 3000: Connection refused
```

**Solution**: 
1. Verify the server is running
2. Check the port number
3. Ensure firewall allows connections

## See Also

- [Validate Command](validate.md) - CLI-based validation
- [Using the CLI](using-the-cli.md) - General CLI usage
- [Installation](installation.md) - Installing CALM tools
