---
id: calm-ai-tools
title: CALM AI Tools
sidebar_position: 6
---

# CALM AI Tools

CALM AI Tools provides AI-powered development assistance for CALM architecture modeling by integrating specialized knowledge and tools directly into your development environment and coding assistant.

## Overview

The `init-ai` command configures your development environment with comprehensive tool prompts that help your coding agent understand CALM schema requirements, validation rules, and best practices. This enables you to get intelligent assistance when creating and modifying CALM architectures.  At present we support these IDEs

|LLM Supported|IDE|
|------------|---|
|LLM available in Github Copilot|VSCode|
|Claude family of LLM|KIRO|

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
calm init-ai -p copilot
```

Or specify a different directory:

```shell
calm init-ai -p kiro --directory /path/to/your/calm-project
```

This command creates a configuration files the `.kiro` sub-directory in your repository that provides AWS Kiro with specialized CALM knowledge.

## Command Options

- **`-p, --provider <provider>`**: The AI coding assistant to setup.  Currently, these two are supported `copilot` and `kiro`.
- **`-d, --directory <path>`**: Target directory (defaults to current directory)
- **`-v, --verbose`**: Enable verbose logging (default: false)
- **`-h, --help`**: Display help for command

## Example Usage

### Help information for `init-ai`
```shell
$ calm init-ai --help
Usage: calm init-ai [options]

Augment a git repository with AI assistance for CALM

Options:
  -p, --provider <provider>  AI provider to initialize (choices: "copilot", "kiro")
  -d, --directory <path>     Target directory (defaults to current directory) (default: ".")
  -v, --verbose              Enable verbose logging. (default: false)
  -h, --help                 display help for command
```


### Use cursor keys to select the AI Assistant thn press "Enter" key
```shell
$ calm init-ai
? Select an AI provider: (Use arrow keys)
❯ copilot 
  kiro 
```

### Specify the AI Assistant
```shell
$ calm init-ai -p copilot
Selected AI provider: copilot
info [calm-ai-tools]:     Setting up CALM AI tools for provider "copilot" in: /Desktop/finos/architecture-as-code/cli
warn [calm-ai-tools]:     Warning: No .git directory found. This may not be a git repository.
info [calm-ai-tools]:     🔍 Validating bundled AI tool resources...
info [calm-ai-tools]:     AI assistant top level directory: .github/chatmodes
info [calm-ai-tools]:     Creating enhanced chatmode config at: /Desktop/finos/architecture-as-code/cli/.github/chatmodes/CALM.chatmode.md
info [calm-ai-tools]:     ✅ Created CALM chatmode configuration from bundled resource
info [calm-ai-tools]:     📁 Created calm-prompts directory
info [calm-ai-tools]:     ✅ Successfully created all 11 tool prompt files
info [calm-ai-tools]:     ✅ CALM AI tools setup completed successfully!
info [calm-ai-tools]:     🚀 To use: Open this repository in with your IDE and start a chat with the CALM chatmode
info [calm-ai-tools]:     📁 Files created in .github/chatmodes directory following copilot AI Assistant conventions
```

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
- **Standards Creation**: JSON Schema 2020-12 Standards for extending CALM components with organizational requirements
- **Documentation Creation**: Generating documentation from CALM models

## Using CALM AI Tools

Once configured, how you get started with CALM AI Assistant will depend on our IDE.

### VSCode
With GitHub Copilot Chat in VS Code:

1. Open GitHub Copilot Chat (Ctrl+Shift+I or Cmd+Shift+I)
2. Select the **CALM** chatmode from the mode selector
3. Ask questions or request assistance with your CALM architecture

### AWS Kiro
With AWS Kiro:

1. Open Kiro Chat
2. Load CALM knowledg into your context window by entering `#CALM.chatmode.md` and press enter key
3. Ask questions or request assistance with our CALM architecture


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
calm init-ai -p <provider> --directory /path/to/your/calm-project
```

This will update the chatmode files with the latest tool prompts and guidance.

## Next Steps

- Learn about [Voice Mode](voice-mode) for hands-free architecture modeling
