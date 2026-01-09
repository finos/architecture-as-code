---
id: ai-advisor
title: AI Architecture Advisor
sidebar_position: 5
---

# How to Use AI for Architecture Analysis

🟢 **Difficulty:** Beginner

Leverage AI assistants to analyze, validate, and improve your CALM architectures.

## When to Use This

Use AI assistance when you need to:
- Review architectures for potential issues
- Get improvement suggestions
- Generate documentation drafts
- Understand complex architectures
- Brainstorm design alternatives

## Quick Start

With GitHub Copilot in VSCode:

1. Open your CALM architecture file
2. Open Copilot Chat (`Cmd+Shift+I` / `Ctrl+Shift+I`)
3. Ask: "Review this architecture for potential issues"

## Step-by-Step

### 1. Architecture Review

**Prompt:**
```
Review this CALM architecture and identify:
- Missing components
- Potential single points of failure
- Security concerns
- Scalability issues
```

### 2. Security Analysis

**Prompt:**
```
Analyze this architecture for security:
- Are all external services authenticated?
- Is sensitive data encrypted?
- Are there any exposed internal services?
- What controls am I missing?
```

### 3. Generate Controls

**Prompt:**
```
Suggest appropriate controls for the payment-service node
considering PCI-DSS compliance requirements.
Format the response as CALM JSON.
```

**Example Response:**
```json
{
  "controls": [
    {
      "unique-id": "ctrl-pci-encryption",
      "name": "PCI-DSS Encryption",
      "description": "All cardholder data encrypted with AES-256"
    },
    {
      "unique-id": "ctrl-pci-audit",
      "name": "PCI-DSS Audit Logging",
      "description": "All access to cardholder data logged"
    }
  ]
}
```

### 4. Generate ADRs

**Prompt:**
```
Generate an ADR for the decision to use PostgreSQL 
for the order-service database. Include:
- Context
- Decision
- Consequences (positive and negative)
- Alternatives considered
```

### 5. Documentation Generation

**Prompt:**
```
Generate a README overview for this architecture
suitable for new team members.
```

### 6. Pattern Suggestions

**Prompt:**
```
What design patterns would improve this e-commerce
architecture for:
- High availability during sales events
- Geographic distribution
- Cost optimization
```

### 7. Compliance Checking

**Prompt:**
```
Does this architecture meet SOC2 requirements?
List any gaps and suggest how to address them.
```

## Effective Prompting

### Be Specific

| Less Effective | More Effective |
|---------------|----------------|
| "Review this" | "Review authentication flow for security" |
| "Add controls" | "Add PCI-DSS controls for payment service" |
| "Is this good?" | "Does this meet our 99.9% availability SLA?" |

### Provide Context

Include relevant constraints:

```
Given that:
- We're a financial services company
- We must comply with PCI-DSS and SOC2
- We expect 10,000 orders per hour peak traffic
- Our budget is limited

Review this architecture and suggest improvements.
```

### Request Specific Formats

```
Provide the response as:
- CALM JSON for new nodes
- A bulleted list of recommendations
- An ADR in standard format
```

## AI Limitations

:::warning Remember
AI is an assistant, not a decision maker:

- **Verify suggestions** against your specific requirements
- **Consider context** AI doesn't know about
- **Review generated code** for accuracy
- **Use as brainstorming** not final authority
:::

## Common Use Cases

| Task | Example Prompt |
|------|---------------|
| **Gap Analysis** | "What's missing from this architecture?" |
| **Risk Assessment** | "What are the failure scenarios?" |
| **Optimization** | "How can I reduce latency in this flow?" |
| **Documentation** | "Generate an operations runbook for this service" |
| **Learning** | "Explain how the authentication flow works" |

## Best Practices

:::tip Iterate
Start with broad questions, then drill into specific areas based on responses
:::

:::tip Share Full Context
Include business requirements and constraints in your prompts
:::

:::tip Validate Output
Always review AI suggestions against your actual requirements
:::

## Related Guides

- [Define Controls](../modeling/controls) - Implement suggested controls
- [Document Decisions](../modeling/adrs) - Record AI-assisted decisions
- [Create Operations Docs](../operations/ops-docs) - Generate ops documentation
