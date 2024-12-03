# CALM CLI

A command line interface to interact with the CALM schema.
You can use these tools to create an instantiation of an architectural pattern, validate that an instantiation conforms to a given pattern, and create visualizations of instantiations and patterns so that you can see what your architecture looks like.

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
  -V, --version        output the version number
  -h, --help           display help for command

Commands:
  visualize [options]  Produces an SVG file representing a visualization of the CALM Specification.
  generate [options]   Generate an instantiation from a CALM pattern file.
  validate [options]   Validate that an instantiation conforms to a given CALM pattern.
  help [command]       display help for command
```

### Generating an instantiation from a CALM pattern file

This command lets you create a shell of an instantiation from a pattern file.
You can try it out using the example patterns provided in this repo under `calm/pattern`.

```shell
% calm generate --help
Usage: calm generate [options]

Generate an instantiation from a CALM pattern file.

Options:
  -p, --pattern <file>          Path to the pattern file to use. May be a file path or a URL.
  -o, --output <file>           Path location at which to output the generated file. (default: "instantiation.json")
  -s, --schemaDirectory <path>  Path to the directory containing the meta schemas to use.
  -v, --verbose                 Enable verbose logging. (default: false)
  -a, --instantiateAll          Instantiate all properties, ignoring the "required" field. (default: false)
  -h, --help                    display help for command
```

The most simple way to use this command is to call it with only the pattern option, which will generate an instantiation with the default filename `instantiation.json` in the current working directory.

```shell
% calm generate -p calm/pattern/api-gateway.json
```

### Validating a CALM instantiation

This command will tell you if an instantiation matches a pattern that you provide.
If it doesn't, then it will output a list of problems that you can address to help your architecture conform to the pattern.

```shell
% calm validate --help
Usage: calm validate [options]

Validate that an instantiation conforms to a given CALM pattern.

Options:
  -p, --pattern <file>          Path to the pattern file to use. May be a file path or a URL.
  -i, --instantiation <file>    Path to the pattern instantiation file to use. May be a file path or a URL.
  -s, --schemaDirectory <path>  Path to the directory containing the meta schemas to use. (default: "../calm/draft")
  --strict                      When run in strict mode, the CLI will fail if any warnings are reported. (default: false)
  -f, --format <format>         The format of the output (choices: "json", "junit", default: "json")
  -o, --output <file>           Path location at which to output the generated file.
  -v, --verbose                 Enable verbose logging. (default: false)
  -h, --help                    display help for command
```


This command can output warnings and errors - the command will only exit with an error code if there are errors present in the output.
Warnings are sometimes provided as hints about how to improve the instantiation, but they are not essential for the architecture to match the pattern.

If you were to try and generate an instantiation from the api-pattern, and then validate the instantation against that pattern like this

```shell
% calm generate -p calm/pattern/api-gateway.json
% calm validate -p calm/pattern/api-gateway.json -i instantiation.json
```

You would get an output which includes a warning like this:

```json
...
{
    "jsonSchemaValidationOutputs": [],
    "spectralSchemaValidationOutputs": [
        {
            "code": "instantiation-has-no-placeholder-properties-string",
            "severity": "warning",
            "message": "String placeholder detected in instantiated pattern.",
            "path": "/nodes/0/interfaces/0/host",
            "schemaPath": "",
            "line_start": 10,
            "line_end": 10,
            "character_start": 18,
            "character_end": 30
        },
        {
            "code": "instantiation-has-no-placeholder-properties-numerical",
            "severity": "warning",
            "message": "Numerical placeholder (-1) detected in instantiated pattern.",
            "path": "/nodes/0/interfaces/0/port",
            "schemaPath": "",
            "line_start": 11,
            "line_end": 11,
            "character_start": 18,
            "character_end": 20
        },
        {
            "code": "instantiation-has-no-placeholder-properties-string",
            "severity": "warning",
            "message": "String placeholder detected in instantiated pattern.",
            "path": "/nodes/0/well-known-endpoint",
            "schemaPath": "",
            "line_start": 14,
            "line_end": 14,
            "character_start": 29,
            "character_end": 56
        },
        {
            "code": "instantiation-has-no-placeholder-properties-string",
            "severity": "warning",
            "message": "String placeholder detected in instantiated pattern.",
            "path": "/nodes/2/interfaces/0/host",
            "schemaPath": "",
            "line_start": 31,
            "line_end": 31,
            "character_start": 18,
            "character_end": 30
        },
        {
            "code": "instantiation-has-no-placeholder-properties-numerical",
            "severity": "warning",
            "message": "Numerical placeholder (-1) detected in instantiated pattern.",
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

### Visualizing the CALM schema

In order to take a look at the architecture that you're working on, beyond just staring at a json file, you can use the visualize command.
This command accepts either an instantiation or a pattern as it's input (not both), and will output an SVG file.
You can then open up that file in the browser to see a box and line diagram which represents your architecture.

```shell
% calm visualize --help
Usage: calm visualize [options]

Produces an SVG file representing a visualization of the CALM Specification.

Options:
  -i, --instantiation <file>  Path to an instantiation of a CALM pattern.
  -p, --pattern <file>        Path to a CALM pattern.
  -o, --output <file>         Path location at which to output the SVG. (default: "calm-visualization.svg")
  -v, --verbose               Enable verbose logging. (default: false)
  -h, --help                  display help for command
```

## Coding for the CLI

The CLI module has its logic split into two modules, `cli` and `shared`.  Both are managed by [npm workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces).

* `cli` module is for anything pertaining to the calling of the core logic, the CLI wrapper
* `shared` module is where the logic being delegated to actually sits, so that it can be re-used for other use-cases if required.

### Getting Started

Ensure you've cloned down the repository ( see root `README.md` for information on this. ) - then go to the root of the repository and execute;

```shell
# Step 1: Install all necessary dependencies for the workspace
npm install

# Step 2: Build the workspace (compiles source code for all workspaces)
npm run build

# Step 3: Link the workspace locally for testing
npm run link:cli

# Step 4 : Run `watch` to check for changes automatically and re-bundle. This watching is via `chokidar` and isn't instant - give it a second or two to propogate changes.
npm run watch
```


### CLI Tests

There are currently two types of tests;

* `cli` tests - these are end-to-end and involve linking the package as part of the test so that we can assert on actual `calm X` invocations.
* `shared` tests - these are where the core logic tests live, like how validation behaves etc.

## Releasing the CLI

Publishing of the CLI to NPM is controlled via [this action](https://github.com/finos/architecture-as-code/blob/main/.github/workflows/publish-cli-to-npm.yml) - this action is triggered whenever a GitHub release is created. To create a github release you can do one of the following;

### Through the Github UI

* Go to your repository on GitHub.
* Click on the Releases tab (under "Code").
* Click the Draft a new release button.
* Fill in:
  * Tag version: Enter the version number (e.g., v1.0.0).
  * Release title: Name the release (e.g., "First Release").
  * Description: Add details about what’s included in the release.
  * Target: Leave as main (or your default branch).
* Click Publish release to create the release and trigger the workflow.

### Through the GitHub CLI (`gh`)

```shell
# Step 1: Authenticate with GitHub if you haven't already
gh auth login

# Step 2: Create the release.
gh release create <version> --title "<release_title>" --notes "<release_description>"
```


