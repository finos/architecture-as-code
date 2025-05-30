# FINOS Official CALM Controls

This directory contains the official repository of standardized CALM control definitions published and maintained by FINOS.

## Purpose

Controls in this directory represent validated, approved control requirements that organizations can use directly or extend for their specific needs. These controls serve as the foundation for establishing consistent governance, compliance, and operational standards across CALM architectures.

## Organization

Controls are organized by domains to facilitate discovery and reuse:

- **Security**: Access control, authentication, authorization, encryption, and other security-related controls
- **Performance**: Response time, throughput, availability, and performance-related requirements
- **Compliance**: Regulatory, audit, and compliance-related controls
- **Operational**: Monitoring, logging, backup, recovery, and operational controls
- **Quality**: Code quality, testing, documentation, and quality assurance controls

## Versioning

All controls in this directory follow semantic versioning to ensure backward compatibility and clear evolution paths.

## Publishing

Controls in this directory are automatically published to the hosted CALM Hub when they are added, modified, or removed. This ensures that the latest approved controls are always available to the community.

## Contributing

To contribute new controls or modify existing ones:

1. Follow the CALM control schema specification
2. Ensure your control is well-documented with clear requirements and rationale
3. Include appropriate examples and test cases
4. Submit a pull request with detailed description of the control's purpose and use cases

## Usage

Organizations can reference these controls directly in their CALM specifications or use them as templates for creating domain-specific variations.

```yaml
# Example reference to a FINOS official control
controls:
  - $ref: "https://calm-hub.finos.org/controls/security/authentication-required.yaml"
```
