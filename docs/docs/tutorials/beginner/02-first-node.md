---
id: 02-first-node
title: "2. Create Your First Node"
sidebar_position: 2
---

# Tutorial 2: Create Your First Node

🟢 **Difficulty:** Beginner | ⏱️ **Time:** 20-30 minutes

## Overview

Use the CALM chatmode you configured in Tutorial 1 to create your first architecture file with AI assistance.

## Learning Objectives

By the end of this tutorial, you will:
- Understand what a node represents in CALM
- Create a valid CALM architecture JSON file
- Use GitHub Copilot with the CALM chatmode
- Validate your architecture using the CLI

## Prerequisites

Complete [Tutorial 1: Setup & CLI](01-setup) first.

## Step-by-Step Guide

### 1. Understand What a Node Represents

A **node** in CALM represents a distinct architectural component. CALM provides built-in node types, but also allows architects to define custom node types.

**Built-in node types include:**
- **actor**: External users or systems
- **system**: High-level business systems
- **service**: Microservices or applications
- **database**: Data storage systems
- **network**: Network infrastructure
- **ldap**: Directory services
- **webclient**: Browser-based clients
- **data-asset**: Data products or datasets

**Custom node types:** You can define your own (e.g., "message-queue", "cache", "api-gateway") to better represent your specific architecture.

### 2. Open the CALM Chatmode in VSCode

1. Open your `calm-learning` repository in VSCode
2. Open the Copilot Chat panel:
   - **Windows/Linux**: `Ctrl+Alt+I` or click the chat icon in the sidebar
   - **Mac**: `Cmd+Shift+I` or click the chat icon in the sidebar
3. **Select the CALM chatmode**:
   - Click the chatmode selector dropdown (shows "General Purpose" by default)
   - Select **"CALM"** from the list
   - The chat panel will now show "CALM" as the active mode

### 3. Use This Prompt with Copilot

Copy and paste this prompt into the Copilot chat (customize the parts in brackets):

```text
Create a new CALM architecture file at architectures/my-first-architecture.json

The architecture should contain a single node representing [describe a system you work with, e.g., "a payment processing service that handles credit card transactions"].

Use appropriate node-type, and include a meaningful unique-id, name, and description.

Make sure the file includes the correct $schema reference and validates against the CALM 1.1 specification.
```

**Example customized prompt:**
```text
Create a new CALM architecture file at architectures/my-first-architecture.json

The architecture should contain a single node representing a customer authentication service that validates user credentials and manages session tokens.

Use appropriate node-type, and include a meaningful unique-id, name, and description.

Make sure the file includes the correct $schema reference and validates against the CALM 1.1 specification.
```

### 4. Review the AI's Output

Copilot will generate the file. **Important:** Don't blindly accept it! Review and verify:

- ✅ File is in the correct location: `architectures/my-first-architecture.json`
- ✅ Contains `$schema` property pointing to CALM 1.1
- ✅ Has a `nodes` array with your node
- ✅ Node has all required properties: `unique-id`, `node-type`, `name`, `description`
- ✅ The `node-type` is appropriate for what you're modeling
- ✅ The `unique-id` uses kebab-case (e.g., "auth-service" not "AuthService")

### 5. Validate Your Architecture

```bash
calm validate -a architectures/my-first-architecture.json
```

If validation fails with errors:
- Read the error message carefully
- Ask Copilot to fix it: `Fix the validation errors in architectures/my-first-architecture.json`
- Validate again

:::note
Warnings about nodes not being referenced in any relationship are fine — you only have one node so far.
:::

### 6. Understand What Was Created

Open the generated file and make sure you understand each part:
- What does the `$schema` property do?
- Why are there four required properties on a node?
- What would happen if you changed the `node-type`?

**Try this:** Ask Copilot to explain:
```text
Explain each property in the node I just created
```

## Key Concepts

### Node Structure

A CALM node requires these properties:

```json
{
  "unique-id": "auth-service",
  "node-type": "service",
  "name": "Authentication Service",
  "description": "Handles user authentication and session management"
}
```

| Property | Purpose |
|----------|---------|
| `unique-id` | Unique identifier within the architecture (kebab-case) |
| `node-type` | Category of component (service, database, actor, etc.) |
| `name` | Human-readable display name |
| `description` | Detailed explanation of what this node represents |

### The $schema Property

The `$schema` property tells validation tools which version of CALM to use:

```json
{
  "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
  "nodes": [...]
}
```

## Resources

- [CALM Node Schema](https://github.com/finos/architecture-as-code/blob/main/calm/release/1.1/meta/core.json)
- [JSON Schema Documentation](https://json-schema.org/)

## Tips

- Use descriptive `unique-id` values — they should convey meaning
- `node-type` should match the nature of the component
- Write clear descriptions that help others understand the component's purpose
- Always validate after making changes

## Next Steps

In [Tutorial 3](03-relationships), you'll connect multiple nodes with relationships!
