# CALM AI Tools

This project contains AI tools and prompts for working with FINOS Common Architecture Language Model (CALM) architectures.

## Overview

The CALM AI tools provide specialized prompts and guidance for AI assistants to help users create, validate, and document CALM architectures. These tools are designed to be embedded in development environments like VS Code to provide context-aware assistance.

## Structure

- `tools/` - Individual tool prompt files
    - `architecture-creation.md` - Guide for creating CALM architecture documents
    - `calm-cli-instructions.md` - Summary of CALM CLI commands and usage flags
    - `control-creation.md` - Guide for control requirements and configurations
    - `documentation-creation.md` - Guide for generating documentation
    - `flow-creation.md` - Guide for business process flows
    - `interface-creation.md` - Critical guidance for interface oneOf constraints
    - `metadata-creation.md` - Guide for metadata array requirements
    - `node-creation.md` - Guide for creating nodes with proper validation
    - `pattern-creation.md` - Guide for reusable architectural patterns
    - `relationship-creation.md` - Guide for creating relationships between nodes
    - `standards-creation.md` - Guide for creating JSON Schema Standards that extend CALM components with organizational requirements

## Usage

These tool prompts are automatically included in the CALM CLI distribution and used by the `calm copilot-chatmode` command to set up AI-powered development environments.

## Contributing

To contribute to the AI tools:

1. Edit the relevant tool prompt file in the `tools/` directory
2. Follow the existing structure and format
3. Include practical examples and validation guidance
4. Test changes by running `calm copilot-chatmode` and verifying the generated prompts

## Validation

Tool prompts should:

- Include critical validation requirements
- Provide working examples
- Reference CALM schema v1.0
- Emphasize common pitfalls and solutions
- Follow consistent markdown formatting

## Design for `init-ai` support

Here is overview of custom prompt template and  how configurations for the different AI assistants will be handled.  After which there are example test runs of the `calm init-ai` command.

## Template for `CALM.chatmode.md`

```markdown
{{{frontmatter}}}

# CALM Architecture Assistant

You are a specialized AI assistant for working with FINOS Common Architecture Language Model (CALM) architectures.

## About CALM

CALM (Common Architecture Language Model) is a declarative, JSON-based modeling language used to describe complex systems, particularly in regulated environments like financial services and cloud architectures.

CALM enables modeling of:

- **Nodes** – components like services, databases, user interfaces
- **Interfaces** – how components communicate using schemas
- **Relationships** – structural or behavioral links between components
- **Flows** – business-level processes traversing your architecture
- **Controls** – compliance policies and enforcement mechanisms
- **Metadata** – supplemental, non-structural annotations

## Your Role

You specialize in helping users create, modify, and understand CALM architecture models. You have deep knowledge of:

- CALM schema validation requirements (release/1.0)
- Best practices for architecture modeling
- JSON schema constraints and validation rules
- VSCode integration and tooling

## First Interaction Instructions

On your first prompt in each session, you MUST:

1. Display: "Loading FINOS CALM instructions..."
2. Read these tool prompt files to understand current CALM guidance:
    {{#each skill-prompts}}
    - {{{../skill-prefix}}}{{../topLevelDirectory}}/{{{this}}}{{{../skill-suffix}}}
    {{/each}}

3. After reading the prompts, confirm you're ready to assist with CALM architectures.

## Guidelines

- Always validate CALM models against the 1.0 schema
- Provide specific, actionable guidance for schema compliance
- Reference the tool prompts for detailed creation instructions
- Use examples that follow CALM best practices
- Help users understand the "why" behind CALM modeling decisions
```

## Configuration files for AI Providers

Naming of AI Provider config file is `<provider>.json`, where `<provider>` is the string used in the `init-ai` subcommand.
* `copilot.json`
* `kiro.json`

These are used to fill in the placeholders in the custom prompt template to setup for specific AI Assistant.

### Configuraton file schema

* **description**: Short human description of the AI assistant integration; used for display or README generation.
* **topLevelDirectory**: Where to create chatmode files for the AI Provider, e.g., .github/chatmodes, .kiro
* **topLevelPromptDirectory**: Location to place the customized prompt file for the AI Provider
* **skill-prefix**: AI Provider delimiter placed before prompt path when referenced in templates
* **skill-suffix**: Matching delimiter placed after prompt path.
* **frontmatter**: Raw YAML/markdown frontmatter that will be inserted at top of generated chatmode files (useful to include metadata like tools, model, description).
* **skill-prompts**: Array of relative paths to prompt files (strings). 

### `copilot.json`
```json
{
    "description": "Github Copilot integrated with FINOS CALM",
    "topLevelDirectory": ".github/chatmodes",
    "topLevelPromptDirectory": "",
    "skill-prefix": "`",
    "skill-suffix": "`",
    "frontmatter": "---\ndescription: An AI Assistant for FINOS CALM development.\ntools: ['codebase', 'editFiles', 'fetch', 'runInTerminal']\nmodel: Claude Sonnet 4.5\n---",
    "skill-prompts": [
        "calm-prompts/architecture-creation.md",
        "calm-prompts/calm-cli-instructions.md",
        "calm-prompts/node-creation.md",
        "calm-prompts/relationship-creation.md",
        "calm-prompts/interface-creation.md",
        "calm-prompts/metadata-creation.md",
        "calm-prompts/control-creation.md",
        "calm-prompts/flow-creation.md",
        "calm-prompts/pattern-creation.md",
        "calm-prompts/documentation-creation.md",
        "calm-prompts/standards-creation.md"
    ]
}
```

### `kiro.json`

```json
{
    "description": "AWS Kiro/Q integrated with FINOS CALM",
    "frontmatter": "---\ninclusion: manual\n---",
    "topLevelDirectory": ".kiro",
    "topLevelPromptDirectory": "steering",
    "skill-prefix": "#[[",
    "skill-suffix": "]]",
    "skill-prompts": [
        "calm-prompts/architecture-creation.md",
        "calm-prompts/calm-cli-instructions.md",
        "calm-prompts/node-creation.md",
        "calm-prompts/relationship-creation.md",
        "calm-prompts/interface-creation.md",
        "calm-prompts/metadata-creation.md",
        "calm-prompts/control-creation.md",
        "calm-prompts/flow-creation.md",
        "calm-prompts/pattern-creation.md",
        "calm-prompts/documentation-creation.md",
        "calm-prompts/standards-creation.md"
    ]
}
```