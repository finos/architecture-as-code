# @finos/calm-server

A standalone HTTP server for the Common Architecture Language Model (CALM) validation functionality.

The `calm-server` executable provides HTTP endpoints for CALM architecture validation.

## Features

- **Bundled CALM Schemas** - All CALM schemas (release and draft) are bundled with the executable
- **Health Check Endpoint** (`GET /health`) - Status endpoint for monitoring
- **Validation Endpoint** (`POST /calm/validate`) - Validate CALM architectures against schemas

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
  -h, --help                      display help for command
```

### Security Considerations

- **Default Host is Localhost**: By default, the server binds to `127.0.0.1` for security
- **No Built-in Authentication**: This server has no authentication or authorization controls
- **Network Exposure**: When binding to non-localhost addresses, a security warning is logged. Only expose to the network in trusted environments

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

