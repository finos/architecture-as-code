---
id: cli
title: CLI
sidebar_position: 10
---

# CALM Command Line Interface (CLI)

The CALM CLI is a set of command-line tools for defining, validating, and generating software architectures using the Common Architecture Language Model (CALM). It enables architects and developers to work with CALM models natively on their systems.

---

## Installation

The CALM CLI allows you to interact with CALM's schema, enabling you to generate, validate, and visualize your architectural definitions.

### Prerequisites

Before installing CALM, ensure that you have the following prerequisites installed on your system:

- **Node.js**: CALM CLI requires Node.js 22.13 or later. You can download and install Node.js from [nodejs.org](https://nodejs.org/).
- **NPM**: The Node Package Manager (NPM) is typically included with Node.js, and it’s used to install the CLI.

### Installing the CALM CLI

To install the CALM CLI globally on your machine, run the following command in your terminal:

```shell
npm install -g @finos/calm-cli
```

or if you use [Homebrew](https://brew.sh):
```shell
brew install calm-cli
```

Once the installation is complete, you can verify that the CLI is installed correctly by typing:

```shell
calm --version
```

This command should display the version of the CALM CLI you have installed.

### Troubleshooting Installation

If you encounter issues during the installation, consider the following troubleshooting steps:

- **Permissions Error**: If you get a permissions error, try running the installation command with elevated privileges using `sudo` (Linux/macOS) or running the command prompt as an administrator (Windows).
- **Node Version**: Ensure you are using a compatible version of Node.js. Updating to a supported version is recommended.

---

## Basic Usage

The CALM CLI provides a set of commands that allow you to interact with CALM’s architecture model.

Once installed, you can access the CLI by typing `calm` in your terminal. This command will display the help text and available commands:

```shell
calm
```

You should see output similar to the following:

```shell
Usage: calm [options] [command]

A set of tools for interacting with the Common Architecture Language Model
(CALM)

Options:
  -V, --version          output the version number
  -h, --help             display help for command

Commands:
  generate [options]     Generate an architecture from a CALM pattern file.
  validate [options]     Validate a CALM document.
  template [options]     Generate files from a CALM model using a template
                         bundle, a single file, or a directory of templates
  docify [options]       Generate a documentation website from your CALM model
                         using a template or template directory
  init-ai [options]      Augment a git repository with AI assistance for CALM
  diff [options]         Compare two CALM documents (architectures or patterns),
                         or the moments of a CALM timeline, and report what
                         changed.
  timeline [options]     Synthesise an implied CALM timeline from a set of local
                         versioned architecture files.
  init-config [options]  Create or update the CALM CLI configuration file
                         (~/.calm.json).
  hub                    Interact with CALM Hub
  workspace              Manage CALM workspace bundle and development helpers
  help [command]         display help for command
```

### AI-Powered Development

CALM CLI includes AI-powered development assistance through the `init-ai` command. This feature integrates with various IDEs and Coding Assistants to provide intelligent help with architecture modeling. Learn more in the [CALM AI Tools](calm-ai-tools) section.

## Commands

| Command | Description |
|---|---|
| [`generate`](../calm-cli/generate.md) | Generate an architecture from a CALM pattern |
| [`validate`](../calm-cli/validate.md) | Validate an architecture, pattern or timeline |
| [`docify`](../calm-cli/docify.md) | Generate a documentation website or report from an architecture |
| [`template`](../calm-cli/template.md) | Generate files from an architecture with a template bundle, file or directory |
| [`diff`](../calm-cli/diff.md) | Compare two CALM documents, or the moments of a timeline |
| [`timeline`](../calm-cli/timeline.md) | Make a CALM timeline from a set of versioned architecture files |
| [`init-config`](../calm-cli/configuration.md) | Create or update the CLI configuration file (`~/.calm.json`) |
| [`init-ai`](calm-ai-tools) | Add CALM AI assistance to a git repository |
| [`hub`](../calm-cli/hub.md) | Push, pull and list documents in CALM Hub |
| [`workspace`](../calm-cli/workspace.md) | Track a set of related CALM documents, version them and push them to CALM Hub |

To set your CALM Hub URL and authentication, see [Configuring the CLI](../calm-cli/configuration.md). The CLI can also load documents directly from HTTP(S) servers. See [Direct URL loading](../calm-cli/direct-url-loading.md).
