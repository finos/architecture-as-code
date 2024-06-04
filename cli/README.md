## CALM CLI

A command line interface to interact with the CALM schema.
You can use these tools to create an instantiation of an architectural pattern, validate that an instantiation conforms to a given pattern, and create visualizations of instantiations and patterns so that you can see what your architecture looks like.

### Using the CLI

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
  -p, --pattern <source>        Path to the pattern file to use. May be a file path or a URL.
  -o, --output <output>         Path location at which to output the generated file. (default: "instantiation.json")
  -s, --schemaDirectory <path>  Path to directory containing schemas to use in instantiation
  -v, --verbose                 Enable verbose logging. (default: false)
  -a, --instantiateAll          Instantiate all properties, ignoring the "required" field. (default: false)
  -h, --help                    display help for command
```

The most simple way to use this command is to call it with only the pattern option, which will generate an instantiation with the default filename 'instantiation.json' in the current working directory.

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
  -p, --pattern <pattern>                         Path to the pattern file to use. May be a file path or a URL.
  -i, --instantiation <instantiation>             Path to the pattern instantiation file to use. May be a file path or a URL.
  -m, --metaSchemasLocation <metaSchemaLocation>  The location of the directory of the meta schemas to be loaded (default: "../calm/draft/2024-03/meta")
  -f, --format <format>                           The format of the output (choices: "json", "junit", default: "json")
  -o, --output <output>                           Path location at which to output the generated file.
  -v, --verbose                                   Enable verbose logging. (default: false)
  -h, --help                                      display help for command
```

This command can output warnings and errors - the command will only exit with an error code if there are errors present in the output.
Warnings are sometimes provided as hints about how to improve the instantiation, but they are not essential for the architecture to match the pattern.

If you were to try and generate an instantiation from the api-pattern, and then validate the instantation against that pattern like this

```shell
% calm generate -p calm/pattern/api-gateway.json
% calm validate -p calm/pattern/api-pattern.json -i instantiation.json
```

You would get an output which includes a warning like this:

```json
...
{
  "code": "instantiation-has-no-placeholder-properties-string",
  "severity": "warning",
  "message": "String placeholder detected in instantiated pattern.",
  "path": "/nodes/2/interfaces/0/host"
}
...
```

which is just letting you know that you have left in a placeholder value which might have been generated with the generate command.
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
