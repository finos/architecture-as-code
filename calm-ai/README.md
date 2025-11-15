# CALM AI Tools

This project contains AI tools and prompts for working with FINOS Common Architecture Language Model (CALM) architectures.

## Overview

The CALM AI tools provide specialized prompts and guidance for AI assistants to help users create, validate, and document CALM architectures. These tools are designed to be embedded in development environments like VS Code to provide context-aware assistance.

## Structure

- `tools/` - Individual tool prompt files
    - `architecture-creation.md` - Guide for creating CALM architecture documents
    - `node-creation.md` - Guide for creating nodes with proper validation
    - `relationship-creation.md` - Guide for creating relationships between nodes
    - `interface-creation.md` - Critical guidance for interface oneOf constraints
    - `metadata-creation.md` - Guide for metadata array requirements
    - `control-creation.md` - Guide for control requirements and configurations
    - `flow-creation.md` - Guide for business process flows
    - `pattern-creation.md` - Guide for reusable architectural patterns
    - `documentation-creation.md` - Guide for generating documentation

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
- Reference CALM schema v1.1
- Emphasize common pitfalls and solutions
- Follow consistent markdown formatting
