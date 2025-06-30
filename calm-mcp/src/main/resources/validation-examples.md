# CALM Validation Tool Test Examples

## Example 1: Valid Basic Architecture

```json
{
  "$schema": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json",
  "$id": "https://example.com/architecture/test-arch",
  "title": "Test Architecture",
  "description": "A basic test architecture",
  "version": "1.0.0",
  "nodes": [
    {
      "unique-id": "node-1",
      "name": "Web Server",
      "description": "Frontend web server",
      "node-type": "service",
      "interfaces": [
        {
          "unique-id": "interface-1",
          "name": "HTTP Interface",
          "description": "HTTP interface for web requests",
          "port": 8080,
          "host": "localhost"
        }
      ]
    }
  ]
}
```

## Example 2: Non-Compliant Architecture (Missing Required Fields)

```json
{
  "$schema": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json",
  "title": "Bad Architecture",
  "nodes": [
    {
      "name": "Web Server",
      "node-type": "service"
    }
  ]
}
```

## Example 3: Basic Pattern for Validation

```json
{
  "$schema": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json",
  "$id": "https://example.com/pattern/web-service",
  "title": "Web Service Pattern",
  "description": "Pattern for web service architectures",
  "version": "1.0.0",
  "nodes": [
    {
      "unique-id": "web-service-node",
      "name": "Web Service",
      "description": "A web service node",
      "node-type": "service",
      "interfaces": [
        {
          "unique-id": "http-interface",
          "name": "HTTP Interface", 
          "description": "HTTP interface",
          "port": -1,
          "host": "PLACEHOLDER"
        }
      ]
    }
  ]
}
```

## Test Commands

### Test 1: Validate Good Architecture
```bash
# This should pass validation
validateCalmArchitecture(
  architectureContent: "Example 1 JSON above",
  format: "json"
)
```

### Test 2: Validate Bad Architecture
```bash
# This should fail validation with missing required fields
validateCalmArchitecture(
  architectureContent: "Example 2 JSON above", 
  strict: true,
  format: "json"
)
```

### Test 3: Validate Against Pattern
```bash
# This should pass with warnings about placeholders
validateCalmArchitecture(
  architectureContent: "Example 1 JSON above",
  patternContent: "Example 3 JSON above",
  format: "json"
)
```
