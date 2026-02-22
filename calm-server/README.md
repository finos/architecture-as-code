# @finos/calm-server

A standalone HTTP server for the Common Architecture Language Model (CALM) validation functionality.

The `calm-server` executable provides HTTP endpoints for CALM architecture validation.

## Features

- **Health Check Endpoint** (`GET /health`) - Status endpoint for monitoring
- **Validation Endpoint** (`POST /calm/validate`) - Validate CALM architectures against schemas

## Usage

### Starting the Server

```bash
# Basic usage (requires schema directory)
calm-server -s /path/to/calm/schemas

# With custom port
calm-server -s ./calm/release --port 8080

# With verbose logging
calm-server -s ./calm/release --port 3000 --verbose
```

### Command-Line Options

```
Usage: calm-server [options]

Options:
  -V, --version                  output the version number
  --port <port>                  Port to run the server on (default: "3000")
  -s, --schema-directory <path>  Path to the directory containing the meta schemas (required)
  -v, --verbose                  Enable verbose logging (default: false)
  -c, --calm-hub-url <url>       URL to CALMHub instance
  -h, --help                     display help for command
```

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
    "architecture": "{\"$schema\":\"https://calm.finos.org/draft/2024-04/meta/core\",\"nodes\":[...]}"
  }'
```

Response (success):
```json
{
  "errors": [],
  "warnings": [],
  "result": "success"
}
```

Response (validation errors):
```json
{
  "errors": [...],
  "warnings": [...],
  "result": "failure"
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

## Configuration

The server can load configuration from `~/.calm.json`:

```json
{
  "calmHubUrl": "https://calm-hub.example.com"
}
```

This allows you to set a default CALM Hub URL without specifying it on every invocation.

## Relationship to CLI

The calm-server package extracts the server functionality from the `@finos/calm-cli` package into a standalone executable. Both implementations share the same core validation logic through `@finos/calm-shared`.

**CLI**: `calm server -s ./calm/release --port 3000`  
**Standalone**: `calm-server -s ./calm/release --port 3000`

## License

Apache-2.0

