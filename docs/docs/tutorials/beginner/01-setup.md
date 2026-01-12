---
id: 01-setup
title: "Setup & CLI"
sidebar_position: 1
---

# Install CALM CLI and Initialize Your Architecture Repository

🟢 **Difficulty:** Beginner | ⏱️ **Time:** 15-20 minutes

## Overview

Set up your CALM workspace with AI-powered assistance and establish the foundation for your architecture learning journey.

## Learning Objectives

By the end of this tutorial, you will:
- Install the CALM CLI tool
- Create a git repository for your architecture work
- Enable GitHub Copilot assistance for architecture development
- Understand the basic project structure for CALM architectures

## Prerequisites

Ensure you have the following installed:
- Git
- Node.js (20+) and npm
- VSCode editor (version 1.96+)
- GitHub Copilot access (optional but recommended)

## Step-by-Step Guide

### 1. Create Your Repository

```bash
mkdir calm-learning
cd calm-learning
git init
```

### 2. Install the CALM CLI

Install via npm:
```bash
npm install -g @finos/calm-cli
```

Or if you use [Homebrew](https://brew.sh):
```shell
brew install calm-cli
```

Verify installation:
```bash
calm --version
```

### 3. Initialize Your Project Structure

Create a basic structure for your architecture files:

```bash
mkdir architectures
mkdir patterns
mkdir docs
touch README.md
```

### 4. Enable AI Assistance with Copilot Chatmode

```bash
calm copilot-chatmode -d .
```

This creates `.github/chatmodes/CALM.chatmode.md` with specialized CALM knowledge for GitHub Copilot. We'll use this chatmode in VSCode in the next tutorial.

### 5. Add a .gitignore

Create `.gitignore`:

```
node_modules/
.DS_Store
*.log
.vscode/settings.json
**/.docusaurus/
```

## Key Concepts

### What is the CALM CLI?

The CALM CLI is a command-line tool that provides:
- **Validation** - Check if your architecture files are valid
- **Generation** - Create architecture scaffolds from patterns
- **Documentation** - Generate docs from your architecture files

### What is the CALM Chatmode?

The chatmode file provides GitHub Copilot with specialized knowledge about:
- CALM schema and syntax
- Best practices for architecture modeling
- Common patterns and examples

## Resources

- [CALM CLI Documentation](/docs/working-with-calm/using-the-cli)
- [GitHub Copilot Chat](https://docs.github.com/en/copilot/using-github-copilot/asking-github-copilot-questions-in-your-ide)

## Tips

- If you don't have GitHub Copilot access, the chatmode file is still useful as documentation for you to reference

## Next Steps

In the [next tutorial](02-first-node), you'll create your first CALM architecture file using AI assistance!
