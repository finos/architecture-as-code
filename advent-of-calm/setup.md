# Keeping Your CALM Tools Up to Date

We make frequent updates to improve your experience with CALM. This page explains how to ensure you're always using the latest versions of all CALM tools.

## CALM CLI

The CALM CLI (`@finos/calm-cli`) is the core command-line tool for working with CALM architecture files.

### Check Your Current Version

```bash
calm --version
```

### Update to the Latest Version

To update the CALM CLI to the latest version, run:

```bash
npm install -g @finos/calm-cli
```

This will fetch and install the latest release from npm. We recommend doing this regularly, especially if you encounter any issues or want to use new features.

### Verify the Update

After updating, verify the new version:

```bash
calm --version
```

## CALM VS Code Extension

The CALM VS Code Extension provides syntax highlighting, validation, and IntelliSense for CALM JSON files.

### Check for Updates

1. Open VS Code
2. Click on the Extensions icon in the sidebar (or press `Cmd+Shift+X` / `Ctrl+Shift+X`)
3. Search for "CALM" in your installed extensions
4. If an update is available, you'll see an "Update" button

### Enable Auto-Updates

To ensure you always have the latest version:

1. Open VS Code Settings (`Cmd+,` / `Ctrl+,`)
2. Search for "extensions auto update"
3. Set **Extensions: Auto Update** to "All Extensions" or "Only Enabled Extensions"

### Manual Update

If auto-update is disabled, you can manually update:

1. Go to the Extensions view
2. Find the CALM extension
3. Click the gear icon and select "Check for Updates"
4. Click "Update" if available

## CALM Copilot Chatmode

The CALM Copilot Chatmode enhances GitHub Copilot with deep knowledge of the CALM specification, making it an expert assistant for architecture authoring.

### What is a Chatmode?

Chatmodes are specialized configurations for GitHub Copilot Chat that provide domain-specific expertise. The CALM chatmode includes:
- Complete CALM schema knowledge
- Best practices for architecture modeling
- Examples and patterns

### Install or Update the Chatmode

Use the CALM CLI to install or update the chatmode:

```bash
calm copilot-chatmode
```

This command will:
- Create or update `.github/copilot-instructions.md` in your repository
- Download the latest chatmode configuration from the CALM project
- Ensure you have the most up-to-date CALM expertise for Copilot

### Apply the Update

After installing or updating the chatmode:

1. **Start a new Copilot Chat session** in VS Code
   - Close any existing chat panels
   - Open a fresh chat session (click the Copilot chat icon or use `Cmd+Shift+I` / `Ctrl+Shift+I`)

2. The updated chatmode will be active in your new chat session

**Note:** You don't need to restart VS Code - just start a new chat session!

## Why Keep Updated?

Regular updates ensure you have:
- **Latest features** - New capabilities and commands
- **Bug fixes** - Resolved issues and improved stability  
- **Better performance** - Optimizations and speed improvements
- **Security patches** - Important security updates
- **Updated documentation** - Accurate help and examples
- **Schema updates** - Support for new CALM specification versions

## Troubleshooting

### CLI Issues

If you experience issues after updating the CLI:

1. Clear npm cache: `npm cache clean --force`
2. Reinstall: `npm uninstall -g @finos/calm-cli && npm install -g @finos/calm-cli`
3. Check Node.js version: `node --version` (Node.js 18+ recommended)

### VS Code Extension Issues

If the extension isn't working properly:

1. Reload VS Code window
2. Disable and re-enable the extension
3. Uninstall and reinstall the extension
4. Check the Output panel (View → Output → select "CALM" from dropdown)

### Chatmode Issues

If Copilot doesn't seem to be using the chatmode:

1. Verify `.github/copilot-instructions.md` exists in your repository root
2. Run `calm copilot-chatmode` to ensure it's up to date
3. Start a completely new chat session (close and reopen)
4. Ensure GitHub Copilot is active (check status bar)
5. Make sure you're chatting from within your repository directory

## Getting Help

If you continue to experience issues:

- Check the [CALM documentation](https://calm.finos.org)
- Visit the [GitHub repository](https://github.com/finos/architecture-as-code)
- Open an issue on GitHub
- Join the FINOS Slack workspace

---

**Last Updated:** December 2024
