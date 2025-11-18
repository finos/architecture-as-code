---
id: voice-mode
title: Voice Mode
sidebar_position: 7
---

# Voice Mode with CALM Copilot Chat

Voice Mode enables hands-free interaction with CALM Copilot Chat, allowing you to speak architecture queries and receive spoken responses directly in the chat interface.

## Getting Started

### Prerequisites

- **VS Code**: Version 1.94 or later
- **CALM Copilot Chatmode**: Configured in your repository (see [CALM Copilot Chatmode](copilot-chatmode))
- **GitHub Copilot Chat**: Active subscription and extension installed
- **Microphone**: A working microphone

### Setup

1. **Install the VS Code Speech Extension**
   - Open VS Code Extensions (Ctrl+Shift+X or Cmd+Shift+X)
   - Search for "VS Code Speech"
   - Click **Install** on the Microsoft-published extension

2. **Grant Microphone Permissions**
   - First use will prompt for microphone access - click **Allow**
   - If prompted on macOS, grant permissions to both "Visual Studio Code" and "Code Helper", then restart VS Code
   - On Windows, ensure VS Code is enabled in Settings → Privacy → Microphone

3. **Configure VS Code Settings**
   - Open VS Code Settings (Ctrl+, or Cmd+,)
   - Search for `accessibility.voice` and add these settings:

```json
{
  "accessibility.voice.autoSynthesize": "on",
  "accessibility.voice.ignoreCodeBlocks": true,
  "accessibility.voice.speechTimeout": 1200,
  "accessibility.voice.keywordActivation": "chatInView"
}
```

## Using Voice Mode

### Starting a Voice Query

1. Open GitHub Copilot Chat (Ctrl+Shift+I or Cmd+Shift+I)
2. Select the **CALM** chatmode
3. Click the microphone icon in the chat input field or press Ctrl+I (Windows/Linux) / Cmd+I (macOS)
4. Speak your query clearly
5. The response will appear as you finish speaking (auto-submit after ~1.2 seconds of silence)
6. Your response will be read aloud automatically

### Quick Voice Activation

Say **"Hey Code"** to activate voice input without clicking anything (requires `keywordActivation` setting enabled above).

### Example Queries

Speak naturally and clearly. Here are examples of how you can use CALM Chatmode via voice:

**Building Your Architecture:**

- "Create a microservices architecture with a web frontend, API gateway, and PostgreSQL database"
- "Add a node for the authentication service with HTTPS interfaces"
- "Create a connects-to relationship from the API gateway to the backend services"
- "Define that the services are deployed in Kubernetes"

**Defining Controls and Compliance:**

- "Add PCI-DSS compliance controls to the payment processor service"
- "Define encryption-in-transit controls for all API connections"
- "What security controls should apply to our database?"

**Modeling Business Processes:**

- "Create a flow for the customer onboarding process"
- "Model the trade execution flow from order placement to settlement"
- "Show the data journey through our system"

**Validation and Best Practices:**

- "Is my architecture valid?"
- "What patterns apply to this microservices design?"
- "What interfaces should the authentication service expose?"
- "Why is my relationship definition failing validation?"

**Documentation and Visualization:**

- "Generate documentation for my architecture"
- "Create a visual diagram of the system"
- "Document all the interfaces and their protocols"

### Listening to Responses

Responses will be read aloud automatically (if `autoSynthesize` is enabled). You can also:

- **Stop playback**: Press **ESC** or click the speaker icon
- **Manual read-aloud**: Click the speaker icon next to any response to hear it read aloud again
