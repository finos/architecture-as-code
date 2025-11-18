---
id: using-the-cli
title: Using the CLI
sidebar_position: 3
---

# Using the CLI

The CALM CLI provides a set of commands that allow you to interact with CALM’s architecture model. This section will cover the basics of using the CLI, including accessing help, understanding command structure, and common options.

## Basic CLI Usage

Once installed, you can access the CLI by typing `calm` in your terminal. This command will display the help text and available commands:

```shell
calm
```

You should see output similar to the following:

```shell
Usage: calm [options] [command]

A set of tools for interacting with the Common Architecture Language Model (CALM)

Options:
  -V, --version       output the version number
  -h, --help          display help for command

Commands:
  generate [options]          Generate an architecture from a CALM pattern file.
  validate [options]          Validate that an architecture conforms to a given CALM pattern.
  copilot-chatmode [options]  Augment a git repository with a CALM VSCode chatmode for AI assistance.
  server [options]            Start a HTTP server to proxy CLI commands. (experimental)
  template [options]          Generate files from a CALM model using a Handlebars template bundle
  docify [options]            Generate a documentation website off your CALM model
  help [command]              display help for command
```

## AI-Powered Development

CALM CLI includes AI-powered development assistance through the `copilot-chatmode` command. This feature integrates with VS Code and GitHub Copilot to provide intelligent help with architecture modeling. Learn more in the [CALM Copilot Chatmode](copilot-chatmode) section.
