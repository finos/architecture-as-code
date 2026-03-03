# @finos/calm-server

The `calm-server` executable provides a standalone HTTP server implementation of CALM validation functionality.

## Architecture

The calm-server provides:

- **Bundled CALM Schemas** - All CALM schemas (release and draft) are bundled during build
- **Health Check Endpoint** (`/health`) - Status endpoint for monitoring
- **Validation Endpoint** (`/calm/validate`) - POST endpoint for validating CALM architectures
- **Rate Limiting** - Protects against abuse with 100 requests per 15 minutes per IP

## Project Structure

```
calm-server/
├── src/
│   ├── index.ts                    # Entry point, CLI argument parsing
│   ├── server/
│   │   ├── cli-server.ts           # Express server startup
│   │   └── routes/
│   │       ├── routes.ts           # Router setup
│   │       ├── health-route.ts     # Health check endpoint
│   │       └── validation-route.ts # Architecture validation endpoint
│   └── *.spec.ts                   # Unit tests
├── dist/
│   ├── index.js                    # Compiled executable
│   └── calm/                       # Bundled CALM schemas
│       ├── release/                # Released schema versions
│       └── draft/                  # Draft schema versions
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── tsup.config.ts                  # Build configuration
├── vitest.config.ts                # Test configuration
└── eslint.config.mjs               # Linting configuration
```

## Building & Running

### Build the package
```bash
npm run build:calm-server
```

This builds the TypeScript code and copies all CALM schemas from `calm/release` and `calm/draft` into `dist/calm/`.

### Run the server locally
```bash
# Using bundled schemas (default)
./calm-server/dist/index.js --port 3000 --verbose

# Or with custom schemas
./calm-server/dist/index.js -s ../calm/release --port 3000 --verbose

# Or using npm
npm run build:calm-server
node calm-server/dist/index.js --port 3000
```

### Global installation (for development)
```bash
npm run link:calm-server

# Use bundled schemas (default)
calm-server --port 3000

# Or provide custom schemas
calm-server -s /path/to/schemas --port 3000
```

## Command-Line Options

```
Usage: calm-server [options]

CALM Server - A server implementation for the Common Architecture Language Model

Options:
  -V, --version                   output the version number
  --port <port>                   Port to run the server on (default: "3000")
  --host <host>                   Host to bind the server to (default: "127.0.0.1")
  -s, --schema-directory <path>   Path to the directory containing the meta schemas to use.
                                  (default: bundled schemas in dist/calm)
  -v, --verbose                   Enable verbose logging (default: false)
  -c, --calm-hub-url <url>        URL to CALMHub instance
  --rate-limit-window <ms>        Rate limit window in milliseconds (default: 900000 = 15 minutes)
  --rate-limit-max <requests>     Max requests per IP within the rate limit window (default: 100)
  -h, --help                      display help for command
```

### Security Notes

- **Default Host**: The server binds to `127.0.0.1` (localhost) by default
- **No Authentication**: The server has **NO authentication or authorization controls**
- **Network Exposure Warning**: If you bind to a non-localhost host (e.g., `0.0.0.0`, `::`, public IP), a warning will be logged. Only do this in trusted network environments

## Testing

### Run tests
```bash
npm run test:calm-server
```

### Test the health endpoint
```bash
# Start the server (uses bundled schemas)
node calm-server/dist/index.js &
SERVER_PID=$!

# Test health
curl http://localhost:3000/health

# Clean up
kill $SERVER_PID
```

### Test the validation endpoint
```bash
# With a CALM architecture JSON
curl -X POST http://localhost:3000/calm/validate \
  -H "Content-Type: application/json" \
  -d '{"architecture": "{\"$schema\": \"https://...\"...}"}'
```

## Dependencies

- `@finos/calm-shared` - Shared utilities, validation logic, schema handling
- `express` - HTTP server framework
- `express-rate-limit` - Rate limiting middleware
- `commander` - CLI argument parsing

## Development Notes

### Copying from CLI

The calm-server implementation mirrors the server functionality from the CLI package (`cli/src/server/`):

- `src/server/cli-server.ts` - Express server setup
- `src/server/routes/routes.ts` - Route configuration
- `src/server/routes/health-route.ts` - Health check
- `src/server/routes/validation-route.ts` - Architecture validation

Both implementations share the same core logic for validation and schema handling through the `@finos/calm-shared` package.

### Build Configuration

The tsup configuration:
- Bundles shared packages (`@finos/calm-shared`, `@finos/calm-models`, `@finos/calm-widgets`)
- Adds Node.js shebang via banner for executable
- Outputs CommonJS format with tree-shaking enabled
- Marks external `node_modules` as external (not bundled)

## Linking for Development

After building, you can link the executable globally:

```bash
npm run link:calm-server
calm-server --help
```

This allows testing the executable without needing to build or reference the dist directory.

## License

Apache-2.0
