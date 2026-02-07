# CALM AI Tools

This directory contains AI tools, prompts, and configuration for integrating AI assistants with FINOS Common Architecture Language Model (CALM) architectures.

## Overview

The CALM AI tools provide:
- **Specialized prompts** to guide AI assistants in creating, validating, and documenting CALM architectures
- **Configuration files** for multiple AI assistant providers (GitHub Copilot, AWS Kiro/Q)
- **Template system** using Handlebars to generate provider-specific prompt files
- **CLI integration** via the `calm init-ai` command for automated setup

These tools enable AI assistants to provide context-aware assistance for CALM architecture development directly within IDEs and development environments.

## Directory Structure

```
calm-ai/
├── ai-assistants/          # AI provider configuration files
│   ├── copilot.json       # GitHub Copilot configuration
│   └── kiro.json          # AWS Kiro/Q configuration
├── templates/             # Handlebars templates
│   └── CALM.chatmode_template.md  # Base prompt template
├── tools/                 # Individual tool prompt files
│   ├── architecture-creation.md
│   ├── calm-cli-instructions.md
│   ├── control-creation.md
│   ├── documentation-creation.md
│   ├── flow-creation.md
│   ├── interface-creation.md
│   ├── metadata-creation.md
│   ├── moment-creation.md
│   ├── node-creation.md
│   ├── pattern-creation.md
│   ├── relationship-creation.md
│   ├── standards-creation.md
│   └── timeline-creation.md
└── package.json           # Package metadata
```

## Tool Prompts (`tools/`)

Individual markdown files providing detailed guidance for specific CALM modeling tasks:

| File | Purpose |
|------|---------|
| `architecture-creation.md` | Guide for creating complete CALM architecture documents with required schema structure |
| `calm-cli-instructions.md` | Summary of CALM CLI commands, validation modes, and usage flags |
| `control-creation.md` | Guide for defining control requirements and compliance configurations |
| `documentation-creation.md` | Guide for generating documentation from CALM models |
| `flow-creation.md` | Guide for modeling business process flows through architecture |
| `interface-creation.md` | Critical guidance for interface definitions and oneOf constraints |
| `metadata-creation.md` | Guide for adding metadata arrays with proper validation |
| `moment-creation.md` | Guide for adding moments to timelines with proper validation |
| `node-creation.md` | Guide for creating nodes (components) with proper validation |
| `pattern-creation.md` | Guide for defining reusable architectural patterns |
| `relationship-creation.md` | Guide for creating relationships between nodes |
| `standards-creation.md` | Guide for creating JSON Schema Standards extending CALM with organizational requirements |
| `timeline-creation.md` | Guide for creating architecture timelines |

Each tool prompt follows a consistent structure:
- Overview and purpose
- Required schema structures
- Creation checklists
- Validation requirements
- Working examples
- Common pitfalls and solutions

## AI Assistant Configuration Schema

Configuration files in `ai-assistants/` define how to integrate CALM prompts with specific AI providers. These JSON files are used by the `calm init-ai` command to generate provider-specific prompt files.

### Configuration Schema

```typescript
{
  // Human-readable description of the integration
  "description": string,
  
  // Directory where AI assistant looks for custom prompts
  // Examples: ".github/chatmodes" (Copilot), ".kiro" (Kiro)
  "topLevelDirectory": string,
  
  // Filename for the main prompt file (may include subdirectory)
  // This file is located within the context of "topLevelDirectory"
  // Examples: "CALM.chatmode.md", "steering/CALM.chatmode.md"
  "topLevelPromptFileName": string,
  
  // Delimiter placed before skill prompt references in templates
  // Examples: "`" (Copilot), "#[[" (Kiro)
  "skillPrefix": string,
  
  // Delimiter placed after skill prompt references
  // Examples: "`" (Copilot), "]]" (Kiro)
  "skillSuffix": string,
  
  // YAML frontmatter inserted at top of generated prompt files
  // provider-specific metadata (model, tools, description, etc.)
  "frontmatter": string,
  
  // Array of relative paths to tool prompt files to include
  // These become references in the generated prompt
  "skillPrompts": string[]
}
```

### Configuration Properties Explained

| Property | Description | Example Values |
|----------|-------------|----------------|
| `description` | Short description for display/README | `"Github Copilot integrated with FINOS CALM"` |
| `topLevelDirectory` | Where provider expects custom prompts | `.github/chatmodes`, `.kiro` |
| `topLevelPromptFileName` | Name of generated prompt file | `CALM.chatmode.md`, `steering/CALM.chatmode.md` |
| `skillPrefix` | Opening delimiter for skill references | `` ` ``, `#[[` |
| `skillSuffix` | Closing delimiter for skill references | `` ` ``, `]]` |
| `frontmatter` | YAML metadata for the provider | Model, tools, inclusion rules |
| `skillPrompts` | List of tool prompts to reference | Paths relative to workspace root |

### Example: GitHub Copilot Configuration (`copilot.json`)

```json
{
    "description": "Github Copilot integrated with FINOS CALM",
    "topLevelDirectory": ".github/chatmodes",
    "topLevelPromptFileName": "CALM.chatmode.md",
    "skillPrefix": "`",
    "skillSuffix": "`",
    "frontmatter": "---\ndescription: An AI Assistant for FINOS CALM development.\ntools: ['codebase', 'editFiles', 'fetch', 'runInTerminal']\nmodel: Claude Sonnet 4.5\n---",
    "skillPrompts": [
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
        "calm-prompts/standards-creation.md",
        "calm-prompts/moment-creation.md",
        "calm-prompts/timeline-creation.md"
    ]
}
```

**GitHub Copilot specifics:**
- Uses backticks (`` ` ``) to reference skill files
- Frontmatter specifies Claude Sonnet 4.5 model and available tools
- Prompts placed in `.github/chatmodes/` directory
- Skill prompts referenced as `` `calm-prompts/architecture-creation.md` ``

### Example: AWS Kiro/Q Configuration (`kiro.json`)

```json
{
    "description": "AWS Kiro/Q integrated with FINOS CALM",
    "frontmatter": "---\ninclusion: manual\n---",
    "topLevelDirectory": ".kiro",
    "topLevelPromptFileName": "steering/CALM.chatmode.md",
    "skillPrefix": "#[[",
    "skillSuffix": "]]",
    "skillPrompts": [
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
        "calm-prompts/standards-creation.md",
        "calm-prompts/moment-creation.md",
        "calm-prompts/timeline-creation.md"
    ]
}
```

**AWS Kiro/Q specifics:**
- Uses `#[[` and `]]` delimiters for skill references
- Frontmatter specifies manual inclusion mode
- Prompts placed in `.kiro/steering/` directory
- Skill prompts referenced as `#[[calm-prompts/architecture-creation.md]]`

## Template System (`templates/`)

The `CALM.chatmode_template.md` file is a Handlebars template that generates provider-specific prompt files. It defines the structure and instructions for AI assistants working with CALM architectures.

### Template Variables

The template uses these Handlebars variables populated from configuration files:

- `{{frontmatter}}` - provider-specific YAML frontmatter
- `{{topLevelDirectory}}` - Directory for custom prompts
- `{{skillPrefix}}` - Opening delimiter for skill references
- `{{skillSuffix}}` - Closing delimiter for skill references
- `{{#each skillPrompts}}` - Iterates over skill prompt paths

### Template Structure

The template includes:
1. **Frontmatter** - provider-specific metadata
2. **Role Definition** - Describes the AI assistant's purpose
3. **CALM Overview** - What CALM is and what it models
4. **First Interaction Instructions** - How to load skill prompts on first use
5. **Guidelines** - Best practices for CALM assistance

## Functionality Summary

### 1. AI Assistant Setup (`calm init-ai`)
- Reads configuration from `ai-assistants/<provider>.json`
- Processes Handlebars template with configuration
- Generates provider-specific prompt files in appropriate directories
- Copies skill prompt files to workspace locations

### 2. Prompt Management
- Provides modular, focused guidance for specific CALM tasks
- Enforces validation requirements and best practices
- References CALM schema v1.2 for accuracy
- Includes working examples and common pitfall warnings

### 3. Multi-provider Support
- Abstracts provider differences through configuration
- Supports multiple delimiter styles for skill references
- Handles different directory structures per provider
- Enables easy addition of new providers via JSON config

### 4. CLI Integration
- Integrated with `calm` CLI via `calm init-ai <provider>` command
- Automated setup reduces manual configuration
- Ensures consistent prompt structure across projects

## Usage

### Setting Up AI Assistant Integration

```bash
# Initialize GitHub Copilot integration
calm init-ai copilot

# Initialize AWS Kiro/Q integration
calm init-ai kiro
```

This command:
1. Reads the corresponding configuration file from `ai-assistants/`
2. Processes the Handlebars template
3. Creates the provider-specific directory structure
4. Generates the main prompt file with skill references
5. Copies skill prompts to the appropriate location

### Using in Development

Once initialized, AI assistants automatically:
1. Load the main prompt on first interaction
2. Read referenced skill prompts for detailed guidance
3. Apply CALM-specific validation and best practices
4. Provide context-aware assistance for architecture modeling

## Contributing

### Adding New Tool Prompts

1. Create a new `.md` file in `tools/` following the existing structure
2. Include overview, required schema, checklist, validation requirements
3. Add working examples and common pitfalls
4. Update all configuration files in `ai-assistants/` to reference the new prompt
5. Test by running `calm init-ai` and verifying AI assistant behavior

### Adding New AI Support Provider

1. Create `<provider>.json` in `ai-assistants/`
2. Define all required schema properties:
   - `description`, `topLevelDirectory`, `topLevelPromptFileName`
   - `skillPrefix`, `skillSuffix`, `frontmatter`, `skillPrompts`
3. Determine provider-specific delimiters and directory structure
4. Update CLI to recognize the new provider
5. Test generation with `calm init-ai <provider>`

### Modifying the Template

When editing `templates/CALM.chatmode_template.md`:
- Maintain Handlebars variable syntax
- Test with all existing provider configurations
- Ensure backwards compatibility
- Update this README if new variables are added

## Validation Requirements

All tool prompts must:
- Reference CALM schema v1.2
- Include mandatory validation steps
- Provide `calm validate` commands
- Emphasize `hasErrors: false` requirement
- Document common pitfalls and solutions
- Follow consistent markdown formatting

## Related Documentation

- **CALM CLI**: See `cli/AGENTS.md` for CLI command details
- **CALM Schema**: https://calm.finos.org/release/1.2/meta/calm.json
- **User Docs**: https://calm.finos.org
- **VSCode Extension**: See `calm-plugins/vscode/AGENTS.md`