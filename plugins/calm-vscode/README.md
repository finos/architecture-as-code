# calm-vscode 

## Commands Added

* `calm-vscode.validate` - Automatically validate any CALM file that we're within. This will run on save and trigger the 

## CALM File Detection

Right now the CALM file detection is incredibly rudamentary. It assumes that you're within one of the following;

* Pattern
* Instansiation of a Pattern

This logic will need to be revisisted once [#490](https://github.com/finos/architecture-as-code/issues/490) is tackled.

## Developing for the Extension Locally

Steps are given under the assumption that you're using VSCode.

* Clone down the repository.
* Open the project within VSCode, the `settings.json` / `launch.json` should cover you for what is required.
* Currently `plugins/calm-vscode` depends on other modules internally, so go to shared and run `npm install && npm run watch`.
* `ctrl+shift+d` - select `Run Extension` and hit `F5` to launch a test IDE with the in-development IDE.

### Caveats

#### JSON Formatting

We're using `spectral` and `ajxvs` for JSON schema validation and external rule validation - this applies some formatting when performing validation so line numbers don't always align with the file that is open.

To get around this - before the `validate` command is executed it will first format the document. If we can determine how to stop `spectral` and `ajvxs` from behaving this way we can remove this limitation.

## Known Issues

* Currently validation is only triggered upon saving, this could be improved massively.
* CALM file validation needs to be refactored once the issue mentioned above is addressed.