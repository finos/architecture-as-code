---
id: copilot-chatmode
title: CALM Copilot Chatmode
sidebar_position: 6
---

# CALM Copilot Chatmode

CALM Copilot Chatmode provides AI-powered development assistance for CALM architecture modeling by integrating specialized knowledge and tools directly into VS Code through GitHub Copilot Chat.

## Overview

The `copilot-chatmode` command configures your development environment with comprehensive tool prompts that help GitHub Copilot understand CALM schema requirements, validation rules, and best practices. This enables you to get intelligent assistance when creating and modifying CALM architectures.

## Prerequisites

Before setting up CALM Copilot Chatmode, ensure you have:

- **VS Code**: Version 1.94 or later
- **GitHub Copilot**: Active GitHub Copilot subscription
- **GitHub Copilot Chat Extension**: Installed in VS Code
- **CALM CLI**: Installed globally (`npm install -g @finos/calm-cli`)
- **Git Repository**: Your project should be in a Git repository

## Setting Up CALM Copilot Chatmode

To set up AI assistance for your CALM project, run the following command in your project directory:

```shell
calm copilot-chatmode
```

Or specify a different directory:

```shell
calm copilot-chatmode --directory /path/to/your/calm-project
```

This command creates a `.github/chatmodes/CALM.chatmode.md` configuration file in your repository that provides GitHub Copilot with specialized CALM knowledge.

## Command Options

- **`-d, --directory <path>`**: Target directory (defaults to current directory)
- **`-v, --verbose`**: Enable verbose logging (default: false)
- **`-h, --help`**: Display help for command

## What Gets Configured

The chatmode setup provides GitHub Copilot with:

- **Schema-Accurate Guidance**: Complete JSON schema definitions for all CALM components ensure that suggestions follow the official CALM specification.
- **Critical Validation Requirements**: Emphasis on important constraints like `oneOf` requirements for interfaces and proper relationship structures.
- **Best Practice Enforcement**: Guidance on naming conventions, relationship patterns, and proper architecture structure.

### Specialized Tools

The chatmode includes separate tools for each CALM component:

- **Architecture Creation**: Guide for creating complete CALM architecture documents
- **Node Creation**: Creating nodes with proper validation and interface definitions
- **Relationship Creation**: Creating relationships with correct types and constraints
- **Interface Creation**: Critical guidance for interface `oneOf` constraints
- **Control Creation**: Security controls, requirements, and configurations
- **Flow Creation**: Business process flows and transitions
- **Pattern Creation**: Reusable architectural patterns using JSON schema
- **Metadata Creation**: Metadata structure and requirements
- **Documentation Creation**: Generating documentation from CALM models

## Using CALM Copilot Chat

Once configured, you can interact with GitHub Copilot Chat in VS Code:

1. Open GitHub Copilot Chat (Ctrl+Shift+I or Cmd+Shift+I)
2. Select the **CALM** chatmode from the mode selector
3. Ask questions or request assistance with your CALM architecture

### Example Queries

Here are some examples of how to use CALM Copilot Chat:

**Creating Components:**
```
Create a new node for an API gateway service with REST interfaces
```

**Validation Help:**
```
Why is my interface definition failing validation?
```

**Best Practices:**
```
What's the recommended way to model a database relationship?
```

**Documentation:**
```
Generate documentation for my CALM architecture
```

## Updating Chatmode Configuration

If you update the CALM CLI or want to refresh the chatmode configuration:

```shell
calm copilot-chatmode --directory /path/to/your/calm-project
```

This will update the chatmode files with the latest tool prompts and guidance.

## Next Steps

- Learn about [Voice Mode](voice-mode) for hands-free architecture modeling
