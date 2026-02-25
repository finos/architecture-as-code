---
id: tool-setup
title: Tool Setup
sidebar_position: 1
---

# Tool setup

## Prerequisites
- Visual Studio Code (v1.106 or later)
- An active GitHub Copilot subscription
- GitHub Copilot and Copilot Chat extensions installed in VS Code
- CALM CLI installed globally (`npm install -g @finos/calm-cli`)


## Installing FINOS CALM Tools Extension for VS Code

To further enhance your CALM modeling experience, install the FINOS CALM Tools extension from the VS Code Marketplace:

1. **Open Visual Studio Code.**
2. **Go to the Extensions view** by clicking the Extensions icon in the Activity Bar or pressing (Windows: `Ctrl+Shift+X`, MacOS `Cmd+Shift+X`).
3. **Search for "CALM Tools"**
4. **Click "Install"** on the CALM Tools extension published by FINOS.
5. **Reload VS Code** if prompted.

The extension provides syntax highlighting, validation, and additional CALM modeling features directly in the VSCode editor.

**Note to the Reader**: 
- The CALM Tools Extension is not available in the KIRO IDE.

---

## Enabling GitHub Copilot AI Support for CALM

For purposes of this tutorial we are using VS Code with GitHub Copilot, follow these steps:

**Run the following command in your project directory:**
   ```sh
   calm init-ai -p copilot
   ```
   This configures Copilot with CALM-specific prompts and knowledge for your workspace.

For more details, see the CALM documentation or run `calm init-ai --help`.

**Note to the Reader**: 
- This tutorial can be used with other CALM supported AI Assistants. 
- Large Language Models (LLM), which underlie CALM's AI Support, are inherently non-deterministic.  Running the same prompt may produce slightly different results, such as different but similar names, different wording in descriptions.
- Given LLM capabilities, the prompts shown in the tutorial are not prescriptive and can be reused with different AI Assistants integrated with CALM.  The reader is encouraged to experiment with alternative wordings to see what works best for the particular AI Assistant being used.  
- Responses from the LLM should be viewed as suggestions and must be reviewed by the architect for accuracy.  The architect should revise responses to reflect their organization's objectives and standards.
- CALM AI Support is an evolving function and capabilities may change in the future.

