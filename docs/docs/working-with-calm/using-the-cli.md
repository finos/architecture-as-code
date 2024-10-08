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

Options: -V, --version output the version number -h, --help display help for command

Commands:
  visualize [options]  Produces an SVG file representing a visualization of the CALM Specification.
  generate [options]   Generate an instantiation from a CALM pattern file.
  validate [options]   Validate that an instantiation conforms to a given CALM pattern.
  help [command]       display help for command

```