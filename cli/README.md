# CALM CLI

A command line interface to interact with the CALM schema.
You can use these tools to create an architecture from a CALM pattern, or validate that an architecture conforms to a given pattern.

## Using the CLI

### Getting Started

Install the CLI on to your machine with this command:

```shell
% npm install -g @finos/calm-cli
```

Type `calm` into your terminal, and you should see the help text printed out.

```shell
% calm
Usage: calm [options] [command]

A set of tools for interacting with the Common Architecture Language Model (CALM)

Options:
  -V, --version       output the version number
  -h, --help          display help for command

Commands:
  generate [options]  Generate an architecture from a CALM pattern file.
  validate [options]  Validate that an architecture conforms to a given CALM pattern.
  server [options]    Start a HTTP server to proxy CLI commands. (experimental)
  template [options]  Generate files from a CALM model using a Handlebars template bundle.
  docify [options]    Generate a documentation website off your CALM model.
  help [command]      display help for command
```

### Generating an architecture from a CALM pattern file

This command lets you create a shell of an architecture from a pattern file.
You can try it out using the example patterns provided in this repo under `calm/pattern`.

```shell
calm
Usage: calm generate [options]

Generate an architecture from a CALM pattern file.

Options:
  -p, --pattern <file>          Path to the pattern file to use. May be a file path or a URL.
  -o, --output <file>           Path location at which to output the generated file. (default: "architecture.json")
  -s, --schemaDirectory <path>  Path to the directory containing the meta schemas to use. (default: "../calm/release")
  -v, --verbose                 Enable verbose logging. (default: false)
  -h, --help                    display help for command
```

The most simple way to use this command is to call it with only the pattern option, which will generate an architecture with the default filename `architecture.json` in the current working directory.

```shell
% calm generate -p calm/pattern/api-gateway.json
```

### Validating a CALM architecture

This command will tell you if an architecture matches a pattern that you provide.
If it doesn't, then it will output a list of problems that you can address to help your architecture conform to the pattern.

```shell
% calm validate --help
Usage: calm validate [options]

Validate that an architecture conforms to a given CALM pattern.

Options:
  -p, --pattern <file>          Path to the pattern file to use. May be a file path or a URL.
  -a, --architecture <file>     Path to the pattern architecture file to use. May be a file path or a URL.
  -s, --schemaDirectory <path>  Path to the directory containing the meta schemas to use. (default: "../calm/release")
  --strict                      When run in strict mode, the CLI will fail if any warnings are reported. (default: false)
  -f, --format <format>         The format of the output (choices: "json", "junit", default: "json")
  -o, --output <file>           Path location at which to output the generated file.
  -v, --verbose                 Enable verbose logging. (default: false)
  -h, --help                    display help for command
```

This command can output warnings and errors - the command will only exit with an error code if there are errors present in the output.
Warnings are sometimes provided as hints about how to improve the architecture, but they are not essential for the architecture to match the pattern.

If you were to try and generate an architecture from the api-pattern, and then validate the architecture against that pattern like this

```shell
% calm generate -p calm/pattern/api-gateway.json
% calm validate -p calm/pattern/api-gateway.json -a architecture.json
```

You would get an output which includes a warning like this:

```json
...
{
    "jsonSchemaValidationOutputs": [],
    "spectralSchemaValidationOutputs": [
        {
            "code": "architecture-has-no-placeholder-properties-string",
            "severity": "warning",
            "message": "String placeholder detected in architecture.",
            "path": "/nodes/0/interfaces/0/host",
            "schemaPath": "",
            "line_start": 10,
            "line_end": 10,
            "character_start": 18,
            "character_end": 30
        },
        {
            "code": "architecture-has-no-placeholder-properties-numerical",
            "severity": "warning",
            "message": "Numerical placeholder (-1) detected in architecture.",
            "path": "/nodes/0/interfaces/0/port",
            "schemaPath": "",
            "line_start": 11,
            "line_end": 11,
            "character_start": 18,
            "character_end": 20
        },
        {
            "code": "architecture-has-no-placeholder-properties-string",
            "severity": "warning",
            "message": "String placeholder detected in architecture.",
            "path": "/nodes/0/well-known-endpoint",
            "schemaPath": "",
            "line_start": 14,
            "line_end": 14,
            "character_start": 29,
            "character_end": 56
        },
        {
            "code": "architecture-has-no-placeholder-properties-string",
            "severity": "warning",
            "message": "String placeholder detected in architecture.",
            "path": "/nodes/2/interfaces/0/host",
            "schemaPath": "",
            "line_start": 31,
            "line_end": 31,
            "character_start": 18,
            "character_end": 30
        },
        {
            "code": "architecture-has-no-placeholder-properties-numerical",
            "severity": "warning",
            "message": "Numerical placeholder (-1) detected in architecture.",
            "path": "/nodes/2/interfaces/0/port",
            "schemaPath": "",
            "line_start": 32,
            "line_end": 32,
            "character_start": 18,
            "character_end": 20
        }
    ],
    "hasErrors": false,
    "hasWarnings": true
}
...
```

which is just letting you know that you have left in some placeholder values which might have been generated with the generate command.
This isn't a full break, but it implies that you've forgotten to fill out a detail in your architecture.

## Calm CLI server (Experimental)

It may be required to have the operations of the CALM CLI available over rest.
The `validate` command has been made available over an API

```shell
calm server --schemaDirectory calm
```

```shell
curl http://127.0.0.1:3000/health

# Missing schema key
curl -H "Content-Type: application/json" -X POST http://127.0.0.1:3000/calm/validate --data @cli/test_fixtures/validation_route/invalid_api_gateway_instantiation_missing_schema_key.json

# Schema value is invalid
curl -H "Content-Type: application/json" -X POST http://127.0.0.1:3000/calm/validate --data @cli/test_fixtures/validation_route/invalid_api_gateway_instantiation_schema_points_to_missing_schema.json

# instantiation is valid
curl -H "Content-Type: application/json" -X POST http://127.0.0.1:3000/calm/validate --data @cli/test_fixtures/validation_route/valid_instantiation.json


```

## CALM Template

The CALM Template system allows users to generate different machine or human-readable outputs from a CALM model by providing a **template bundle**.

```shell
calm template --help
Usage: calm template [options]

Generate files from a CALM model using a Handlebars template bundle.

Options:
  --input <path>                      Path to the CALM model JSON file.
  --bundle <path>                     Path to the template bundle directory.
  --output <path>                     Path to output directory.
  --url-to-local-file-mapping <path>  Path to mapping file which maps URLs to local paths.
  -v, --verbose                       Enable verbose logging. (default: false)
  -h, --help                          display help for command
```

### Creating a Template Bundle

A template bundle consists of:

- `index.json`: Defines the structure of the template and how it maps to CALM model elements.
- A **CalmTemplateTransformer** implementation: Transforms the CALM model into a format that can be rendered by Handlebars.
- Handlebar templates define the final output format.
- The `--url-to-local-file-mapping` option allows you to provide a JSON file that maps external URLs to local files.  
   This is useful when working with files that are not yet published but are referenced in the model.

  Example content

      ```json
      {
          "https://calm.finos.org/docuflow/flow/document-upload": "flows/flow-document-upload.json"
      }
      ```

  Sample usage would be as follows (assuming at root of project)

```shell
calm template --input ./cli/test_fixtures/template/model/document-system.json   --bundle cli/test_fixtures/template/template-bundles/doc-system   --output one_pager   --url-to-local-file-mapping cli/test_fixtures/template/model/url-to-file-directory.json -v
```

## CALM Docify

The **CALM Docify** command generates documentation from a CALM model.

```shell
calm docify --help
Usage: calm docify [options]

Generate a documentation website off your CALM model.

Options:
  --input <path>                      Path to the CALM model JSON file.
  --output <path>                     Path to output directory.
  --url-to-local-file-mapping <path>  Path to mapping file which maps URLs to local paths.
  -v, --verbose                       Enable verbose logging. (default: false)
  -h, --help                          display help for command
```

Sample usage for you to try is as follows (assuming at root of project)

```shell
calm docify --input ./cli/test_fixtures/template/model/document-system.json --output ./output/documentation --url-to-local-file-mapping ./cli/test_fixtures/template/model/url-to-file-directory.json
```
