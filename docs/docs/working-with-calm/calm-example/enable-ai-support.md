---
id: enable-ai-support
title: Enabling AI Support for CALM
sidebar_position: 2
---


# Enabling GitHub Copilot AI Support for CALM

To enable AI-powered assistance for CALM architecture modeling in VS Code using GitHub Copilot, follow these steps:

## Prerequisites
- Visual Studio Code (v1.104 or later)
- An active GitHub Copilot subscription
- GitHub Copilot and Copilot Chat extensions installed in VS Code
- CALM CLI installed globally (`npm install -g @finos/calm-cli`)
- Your CALM project in a Git repository

## Setup Instructions

1. **Open your CALM project in VS Code.**
2. **Install and sign in to GitHub Copilot and Copilot Chat extensions.**
3. **Run the following command in your project directory:**
   ```sh
   calm init-ai -p copilot
   ```
   This configures Copilot with CALM-specific prompts and knowledge for your workspace.
4. **Start modeling!**
   - Use Copilot suggestions and chat to accelerate CALM architecture authoring and validation.

---

For more details, see the CALM documentation or run `calm init-ai --help`.
