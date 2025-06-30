# CALM Architecture Validation Tool

This tool allows you to validate CALM architecture files using the calm-cli directly from the MCP interface.

## How to Use

The `validateCalmArchitecture` tool accepts the following parameters:

### Required Parameters
- **architectureContent**: JSON content of the CALM architecture to validate (as a string)

### Optional Parameters
- **patternContent**: JSON content of the CALM pattern to validate against (as a string)
- **strict**: Run in strict mode - fail on warnings (boolean, default: false)
- **format**: Output format - "json" or "junit" (string, default: "json")

## Example Usage

### Basic Architecture Validation
```json
{
  "architectureContent": "{\"$schema\": \"https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json\", \"title\": \"My Architecture\"}"
}
```

### Validation Against a Pattern
```json
{
  "architectureContent": "{\"$schema\": \"https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json\", \"title\": \"My Architecture\"}",
  "patternContent": "{\"$schema\": \"https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json\", \"title\": \"Required Pattern\"}"
}
```

### Strict Validation
```json
{
  "architectureContent": "{\"$schema\": \"https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json\", \"title\": \"My Architecture\"}",
  "strict": true,
  "format": "junit"
}
```

## Response Format

The tool returns a `ValidationResult` object with the following properties:

- **success**: Boolean indicating if validation passed
- **output**: String containing the validation output (formatted according to the format parameter)
- **error**: String containing any error messages
- **exitCode**: Integer exit code from the calm-cli process

## Prerequisites

For this tool to work, you need:

1. Node.js installed on the system
2. The `@finos/calm-cli` package available (either globally installed or accessible via npx)
3. The CALM CLI project structure available in the workspace

## How It Works

1. The tool creates temporary files for the architecture and pattern content
2. Executes the calm-cli validate command using npx
3. Captures the output and error streams
4. Cleans up temporary files automatically
5. Returns the validation results

## Common Validation Rules

The tool validates against the CALM modeling rules including:

1. Every element must have a `unique-id`, `name`, and `description`
2. Use only properties defined in the CALM schema
3. Use `detailed-architecture` on nodes to point to deeper architectural documents
4. Embed controls using valid `control-requirement` schemas
5. Interfaces must use well-defined schemas or conform to inline interface types
6. Relationships should define `relationship-type` and include `protocol` when appropriate
7. Metadata should only include relevant non-structural annotations
8. All flows must reference valid `relationship-unique-id`s and contain at least one transition
9. Avoid redundant or implied links—define structure explicitly
10. Use consistent casing for IDs and human-readable formatting for names and descriptions

For more details on CALM modeling rules, use the `calm://rules.md` resource.
