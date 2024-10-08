---
id: metadata
title: Metadata
sidebar_position: 5
---

# Metadata in CALM

Metadata in CALM provides a way to capture additional information that doesn't fit neatly into nodes or relationships. This flexibility allows architects to extend the model with custom data that can drive specific tools, processes, or analyses.

## What is Metadata?

Metadata is an arbitrary collection of objects that can be attached to nodes, relationships, or the entire architecture. It can be used to capture details like compliance tags, versioning information, custom attributes, or any other data relevant to your architecture.

### Key Properties of Metadata

Metadata objects can contain any properties, offering maximum flexibility. Some common uses include:

- **Descriptive Attributes**: Adding information like creation dates, version numbers, or status indicators.
- **Compliance and Security Tags**: Identifying nodes or relationships that require special handling due to regulatory requirements.
- **Custom Extensions**: Adding bespoke data fields that may be used by specific tools or integrations.

### Example of Metadata

Here’s an example of metadata applied to a service node, capturing compliance information:

```json
{
  "metadata": [
    {
      "key": "compliance",
      "value": "PCI-DSS"
    },
    {
      "key": "created-by",
      "value": "architecture-team"
    }
  ]
}
```

### Using Metadata Effectively

Metadata allows you to enrich your architecture model with any additional context that might be necessary for your specific needs:

- **Drive Automation**: Use metadata to trigger specific behaviors in downstream tools, such as alerting on non-compliant components.
- **Custom Reporting**: Generate reports or visualizations that include metadata fields to provide additional insights.
- **Enhance Validation**: Include metadata in validation processes to check for compliance or completeness.

