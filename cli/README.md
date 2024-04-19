## CALM CLI
A command line interface to interact with the CALM schema.

## Building & linking the CLI

Clone the project and run the following commands:

```shell
npm install
npm run build
npx link
```

When you've made a change to the CLI and want to test it out, you can rerun the build and link steps.
This will make the CLI available on your local `node_modules` path.

`npx link` uses the `link` package to symlink the `calm` executable in `node_modules/.bin` to your locally-built CLI.

Note: you can also use `npm link` but this installs to your global package registry.
This will make the executable available as just `calm`, but will pollute your global NPM profile and may require `sudo` depending on your OS.

### Using the CLI
Type `npx calm` into your terminal, and you should see the help text printed out.

```shell
% npx calm
Usage: calm [options] [command]

A set of utilities for interacting with CALM

Options:
  -V, --version        output the version number
  -h, --help           display help for command

Commands:
  visualize [options]  Produces an SVG file representing a visualization of the CALM Specification.
  generate [options]   Generate an instantiation from a CALM pattern file.
  validate [options]
  help [command]       display help for command
```

### Visualizing the CALM schema
```shell
% npx calm visualize --help
Usage: calm visualize [options]

Produces an SVG file representing a visualization of the CALM Specification.

Options:
  -i, --instantiation <file>  Path to an instantiation of a CALM pattern.
  -p, --pattern <file>        Path to a CALM pattern.
  -o, --output <file>         Path location at which to output the SVG. (default: "calm-visualization.svg")
  -v, --verbose               Enable verbose logging. (default: false)
  -h, --help                  display help for command
```

### Generating an instantiation from a CALM pattern file
```shell
npx calm generate --help 
Usage: calm generate [options]

Generate an instantiation from a CALM pattern file.

Options:
  -p, --pattern <source>  Path to the pattern file to use. May be a file path or a URL.
  -o, --output <output>   Path location at which to output the generated file.
  -v, --verbose           Enable verbose logging. (default: false)
  -h, --help              display help for command
```

### Validating a CALM instantiation
```shell
% npx calm validate --help 
Usage: calm validate [options]

Options:
  -p, --pattern <pattern>                         Path to the pattern file to use. May be a file path or a URL.
  -i, --instantiation <instantiation>             Path to the pattern instantiation file to use. May be a file path or a URL.
  -m, --metaSchemasLocation <metaSchemaLocation>  The location of the directory of the meta schemas to be loaded (default: "../calm/draft/2024-03/meta")
  -v, --verbose                                   Enable verbose logging. (default: false)
  -h, --help                                      display help for command

```