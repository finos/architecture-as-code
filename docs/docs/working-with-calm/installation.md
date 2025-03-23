---
id: installation
title: Installation
sidebar_position: 2
---

# Installation

To start using CALM, you need to install the CALM Command Line Interface (CLI). The CLI allows you to interact with CALM's schema, enabling you to generate, validate, and visualize your architectural definitions.

## Prerequisites

Before installing CALM, ensure that you have the following prerequisites installed on your system:

- **Node.js**: CALM CLI requires Node.js. You can download and install Node.js from [nodejs.org](https://nodejs.org/).
- **NPM**: The Node Package Manager (NPM) is typically included with Node.js, and it’s used to install the CLI.

## Installing the CALM CLI

To install the CALM CLI globally on your machine, run the following command in your terminal:

```shell
npm install -g @finos/calm-calm-cli
```

Once the installation is complete, you can verify that the CLI is installed correctly by typing:

```shell
calm --version
```

This command should display the version of the CALM CLI you have installed.

## Troubleshooting Installation

If you encounter issues during the installation, consider the following troubleshooting steps:

- **Permissions Error**: If you get a permissions error, try running the installation command with elevated privileges using `sudo` (Linux/macOS) or running the command prompt as an administrator (Windows).
- **Node Version**: Ensure you are using a compatible version of Node.js. Updating to the latest LTS version is recommended.
