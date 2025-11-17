---
id: voice-mode
title: Voice Mode
sidebar_position: 6
---

# Voice Mode with CALM Copilot Chat

Voice Mode enables hands-free interaction with CALM Copilot Chat, allowing you to speak architecture queries and receive spoken responses. This feature leverages the VS Code Speech extension to provide a natural voice interface for CALM architecture modeling.

## Overview

Voice Mode enhances the CALM Copilot Chat experience by enabling:

- **Speech-to-text**: Speak your architecture queries naturally
- **Text-to-speech**: Receive spoken responses from the AI assistant
- **Hands-free workflow**: Keep your hands on the keyboard or mouse while interacting
- **Accessibility**: Improved experience for users who prefer or require voice interaction
- **Local processing**: All voice audio data is processed locally on your computer (no internet required)
- **Language**: Currently supports English

## Prerequisites

Before using Voice Mode, ensure you have:

- **VS Code**: Version 1.94 or later
- **CALM Copilot Chatmode**: Configured in your repository (see [CALM Copilot Chatmode](copilot-chatmode))
- **GitHub Copilot Chat**: Active subscription and extension installed
- **VS Code Speech Extension**: `ms-vscode.vscode-speech`
- **Microphone**: Working microphone with proper system permissions

## Installing the VS Code Speech Extension

### From VS Code Marketplace

1. Open VS Code
2. Navigate to Extensions (Ctrl+Shift+X or Cmd+Shift+X)
3. Search for "VS Code Speech"
4. Look for the extension published by Microsoft (`ms-vscode.vscode-speech`)
5. Click **Install**
6. Reload VS Code if prompted

### From Command Line

```shell
code --install-extension ms-vscode.vscode-speech
```

### Verifying Installation

After installation, you should see a microphone icon in the GitHub Copilot Chat interface.

## Setting Up Microphone Permissions

Voice Mode requires microphone access. The first time you use it, you'll need to grant permissions:

### Windows

1. When prompted, click **Allow** to grant microphone access
2. If you missed the prompt, go to Settings → Privacy → Microphone
3. Ensure VS Code has microphone permissions enabled

### macOS

1. When prompted, click **OK** to grant microphone access
2. If you missed the prompt, go to System Preferences → Security & Privacy → Privacy → Microphone
3. Check the box next to VS Code or Code Helper
4. Restart VS Code for changes to take effect

### Linux

1. Ensure your microphone is recognized by the system
2. Check audio input settings in your system's sound preferences
3. Verify VS Code can access the microphone device

## Using Voice Mode

### Activating Voice Input

There are three ways to activate voice input in CALM Copilot Chat:

**Method 1: Microphone Icon**
1. Open GitHub Copilot Chat (Ctrl+Shift+I or Cmd+Shift+I)
2. Select the **CALM** chatmode
3. Click the microphone icon in the chat input field
4. Speak your query
5. Wait for auto-submit (after 1.2 second pause) or press Enter manually

**Method 2: Hold-to-Speak (Recommended for Quick Queries)**
- Press and hold **Ctrl+I** (Windows/Linux) or **Cmd+I** (macOS)
- Speak while holding the key
- Release to auto-submit immediately
- No waiting for pause detection!

**Method 3: "Hey Code" Voice Activation**

Enable hands-free activation by saying "Hey Code":

1. Configure the setting:
   ```json
   {
     "accessibility.voice.keywordActivation": "chatInView"
   }
   ```
2. Say **"Hey Code"** out loud
3. Microphone activates automatically
4. Speak your query
5. Auto-submits after pause

**Auto-Submit Configuration:**

Control when voice input submits automatically:
```json
{
  "accessibility.voice.speechTimeout": 1200  // Auto-submit after 1.2 seconds of silence
}
```

- Default: Auto-submits after brief pause
- Set to `0` to disable auto-submit (requires manual Enter)

### Speaking Architecture Queries

When using Voice Mode, speak naturally and clearly. Here are examples:

**Creating Nodes:**
```
"Create a new node for a PostgreSQL database with a TCP interface on port 5432"
```

**Adding Relationships:**
```
"Add a connects-to relationship from the API service to the database"
```

**Validation Queries:**
```
"Validate my architecture against the microservices pattern"
```

**Documentation Requests:**
```
"Generate documentation for all nodes in my architecture"
```

### Receiving Spoken Responses

To enable text-to-speech for chat responses, you need to configure VS Code settings:

**Method 1: Automatic Read Aloud**

Enable automatic text-to-speech by configuring VS Code settings (no screen reader required):

1. Open VS Code Settings (Ctrl+, or Cmd+,)
2. Search for `accessibility.voice.autoSynthesize`
3. Set to **on** to automatically read responses when voice input is used
4. Optionally, set `accessibility.voice.ignoreCodeBlocks` to **true** to skip reading code snippets

**Important**: This works for all users - you do NOT need to enable screen reader mode.

**Note**: If automatic playback doesn't work even with this setting enabled, this is a known limitation in some VS Code versions. Use Method 2 (manual speaker icon) as a reliable alternative.

**Method 2: Manual Read Aloud**

Each chat response includes a speaker icon (🔈):

1. Look for the speaker icon next to the chat response
2. Click the icon to have the response read aloud
3. Click again or press Escape to stop playback

**Audio Controls:**

- **Stop playback**: Press **ESC** key, or click the speaker icon/animated pulse icon
- **Adjust volume**: Use your system's volume controls
- **Skip to text**: View the written response in the chat window simultaneously
- **Quick workflow**: Press ESC to skip current response and move to next query

**Note**: Text-to-speech is processed locally on your machine - no internet connection required for this feature.

## Best Practices

### For Better Transcription Accuracy

1. **Speak clearly**: Enunciate technical terms and architecture concepts
2. **Reduce background noise**: Use a quiet environment or noise-canceling microphone
3. **Use natural pace**: Don't speak too fast or too slow
4. **Spell if needed**: For unique identifiers, say "spell: A-P-I dash G-W"
5. **Confirm important details**: Review transcribed text before submitting

### For Efficient Workflow

1. **Start with context**: Begin queries with the component type (e.g., "For the API node...")
2. **Break complex requests**: Split complicated architectures into multiple queries
3. **Use follow-ups**: Reference previous responses with "that node" or "the relationship we just created"
4. **Mix voice and text**: Use voice for creation, text for fine-tuning
5. **Skip unwanted audio**: Press ESC to skip text-to-speech and move to next query immediately
6. **Rapid query workflow**:
   - Say "Hey Code" → ask question → press ESC (skip audio) → repeat

### For Technical Terms

Common CALM terms that may need careful pronunciation:

- **"Metadata"** - say clearly as "meta-data"
- **"OneOf constraint"** - say "one of constraint" with emphasis
- **"Interface"** - distinguish from "surface"
- **"Node relationships"** - clarify between "node" and "note"

## Troubleshooting

### Microphone Not Detected

**Symptom**: Microphone icon is grayed out or missing

**Solutions**:
1. Check system microphone permissions for VS Code
2. Verify microphone is connected and working in other applications
3. Restart VS Code after granting permissions
4. Try unplugging and reconnecting USB microphones
5. Check VS Code Speech extension is enabled

### Poor Transcription Accuracy

**Symptom**: Voice input is frequently misunderstood

**Solutions**:
1. Reduce background noise in your environment
2. Move microphone closer to your mouth (2-6 inches ideal)
3. Use a better quality microphone if available
4. Speak more slowly and enunciate technical terms
5. Try spelling out complex identifiers
6. Check microphone input levels in system settings

### High Latency

**Symptom**: Significant delay between speaking and seeing transcription

**Solutions**:
1. Check your internet connection (speech processing may use cloud services)
2. Close unnecessary VS Code extensions or applications
3. Restart VS Code to clear any cached processes
4. Check VS Code performance in Task Manager/Activity Monitor
5. Try updating VS Code and the Speech extension

### No Spoken Response

**Symptom**: Voice input works but responses aren't spoken

**Solutions**:
1. Enable automatic text-to-speech: Set `accessibility.voice.autoSynthesize` to `on` in VS Code settings
2. Manually trigger: Click the speaker icon (🔈) next to each chat response
3. Check system volume and unmute speakers
4. Verify the VS Code Speech extension is installed and enabled
5. Check if another application is using audio output
6. Restart the Speech extension (disable and re-enable in Extensions panel)
7. Review all `accessibility.voice.*` settings in VS Code

### Extension Conflicts

**Symptom**: Voice Mode causes issues with other extensions

**Solutions**:
1. Disable other speech or voice extensions temporarily
2. Check for conflicting keyboard shortcuts (Ctrl+I / Cmd+I)
3. Update all extensions to latest versions
4. Report compatibility issues to the extension authors

## Accessibility Features

Voice Mode enhances accessibility for CALM architecture development:

### Screen Reader Compatibility

Voice Mode works alongside screen readers:

1. **VoiceOver (macOS)**: Compatible with VS Code's VoiceOver support
2. **NVDA (Windows)**: Works with NVDA screen reader
3. **JAWS (Windows)**: Compatible with JAWS screen reader
4. **Orca (Linux)**: Works with Orca screen reader

**Tip**: You can use screen reader and Voice Mode simultaneously for input/output flexibility.

### Voice-Only Workflow

For users who prefer or require voice-only interaction:

1. Use voice input for all queries
2. Enable spoken responses for AI feedback
3. Navigate VS Code with keyboard shortcuts
4. Use voice commands for file operations (if configured)

### Cognitive Assistance

Voice Mode can help with:

- **Reduced cognitive load**: Speak thoughts directly without typing
- **Multi-tasking**: Review diagrams while asking questions
- **Memory support**: Voice interaction can be more natural for some users

## Performance Considerations

### Network Requirements

Voice Mode may require internet connectivity for:

- Speech-to-text processing (depending on configuration)
- Text-to-speech synthesis
- GitHub Copilot AI responses

**Tip**: For offline work, rely on text input and the CALM CLI validation.

### Resource Usage

Voice Mode uses additional system resources:

- **CPU**: Speech processing and audio handling
- **Memory**: Audio buffers and transcription models
- **Microphone**: Continuous audio input when activated

**Tip**: Deactivate Voice Mode when not in use to conserve resources.

## Platform Support and Requirements

The VS Code Speech extension is tested and supported on:

- **Windows**: 64-bit (Windows 10/11)
- **macOS**: 64-bit Intel and ARM (Apple Silicon)
- **Linux**: 64-bit and ARM architectures

### Windows-Specific Notes

- Default microphone may need selection in Windows Sound settings
- Windows Defender may prompt for microphone permissions
- Windows 10/11 privacy settings control app microphone access (Settings → Privacy → Microphone)
- Ensure VS Code is listed and enabled in microphone permissions

### macOS-Specific Notes

- System Integrity Protection (SIP) requires explicit permissions
- May need to grant permissions to both "Visual Studio Code" and "Code Helper" in System Preferences
- macOS Ventura (13.0)+ has enhanced privacy controls
- After granting permissions, restart VS Code for changes to take effect
- Go to System Preferences → Security & Privacy → Privacy → Microphone

### Linux-Specific Notes

- Supports both PulseAudio and PipeWire audio systems
- Check microphone detection with `arecord -l` (ALSA) or `pactl list sources` (PulseAudio)
- Some distributions may require additional audio packages (e.g., `alsa-utils`, `pulseaudio`)
- Verify microphone permissions for Snap/Flatpak installations if using containerized VS Code

## Testing Voice Mode

To validate your Voice Mode setup:

### Functional Test

1. Open CALM Copilot Chat with CALM mode selected
2. Click the microphone icon or press Ctrl+I / Cmd+I
3. Say: "What is a CALM node?"
4. Verify the transcription appears correctly
5. Verify you receive a spoken response (if enabled)

### Accuracy Test

1. Speak a technical query: "Create a node with a REST API interface"
2. Check transcription for accuracy
3. If incorrect, adjust speaking pace and retry

### Latency Test

1. Speak a short query
2. Note the delay between speaking and transcription appearing
3. Acceptable: < 1 second for short phrases
4. If > 3 seconds, check network and system performance

## VS Code Settings Reference

Here are the key VS Code settings for Voice Mode:

### accessibility.voice.autoSynthesize

Controls whether chat responses are automatically read aloud when voice input is used.

- **Type**: boolean or string
- **Default**: `false`
- **Values**: `on`, `off`
- **Recommended**: Set to `on` for automatic text-to-speech
- **Note**: Does NOT require screen reader mode to be enabled - works for all users
- **Known Issue**: May not work reliably in all VS Code versions; use manual speaker icon as fallback

### accessibility.voice.ignoreCodeBlocks

Skip reading code blocks when text-to-speech is enabled.

- **Type**: boolean
- **Default**: `false`
- **Recommended**: Set to `true` to avoid reading lengthy code snippets

### accessibility.voice.speechTimeout

Controls auto-submit timing after you stop speaking.

- **Type**: number (milliseconds)
- **Default**: `1200` (1.2 seconds)
- **Recommended**: Keep default, or set to `0` to disable auto-submit
- **Usage**: Higher values give you more time before auto-submit; lower values are faster but may cut you off

### accessibility.voice.keywordActivation

Enable "Hey Code" voice activation for hands-free operation.

- **Type**: string
- **Default**: `off`
- **Values**: `off`, `chatInView`, `inline`, `quickChat`
- **Recommended**: Set to `"chatInView"` for hands-free chat activation
- **Usage**: Say "Hey Code" to activate voice input without touching keyboard/mouse

### accessibility.voice.speechLanguage

Set the language for speech recognition.

- **Type**: string
- **Default**: `"auto"` (uses VS Code display language)
- **Values**: `"auto"`, `"en"` (English), and other supported language codes
- **Note**: Currently only English is fully supported

### Complete Recommended Configuration:

1. Open VS Code Settings (File → Preferences → Settings or Ctrl+, / Cmd+,)
2. Search for `accessibility.voice`
3. Adjust the settings as needed
4. Alternatively, edit `settings.json`:

```json
{
  // Text-to-speech
  "accessibility.voice.autoSynthesize": "on",
  "accessibility.voice.ignoreCodeBlocks": true,

  // Auto-submit and timing
  "accessibility.voice.speechTimeout": 1200,

  // Voice activation (optional - for hands-free "Hey Code")
  "accessibility.voice.keywordActivation": "chatInView",

  // Language
  "accessibility.voice.speechLanguage": "auto"
}
```

## Feedback and Support

Voice Mode is enabled through the VS Code Speech extension. For issues:

- **VS Code Speech Extension**: [GitHub Issues](https://github.com/microsoft/vscode/issues) (label: speech)
- **CALM Copilot**: [FINOS CALM Issues](https://github.com/finos/architecture-as-code/issues)
- **GitHub Copilot**: [GitHub Support](https://support.github.com/)
