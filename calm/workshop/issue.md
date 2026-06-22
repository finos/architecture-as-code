# Standards Documentation Issue

## Issue Summary

Add comprehensive documentation for the CALM Standards concept introduced in [#1231](https://github.com/finos/architecture-as-code/issues/1231) to clarify the intention of Standards and how they will be used within CALM architectures.

## Background

Based on [#713](https://github.com/finos/architecture-as-code/issues/713) and [#1231](https://github.com/finos/architecture-as-code/issues/1231), the concept of **Standards** was introduced to support JSON schema fragments that can be reused across a company to extend the core CALM schemas.

## Standards Concept Overview

**Standards** allow organizations to create JSON schema fragments that can be referenced and reused across their CALM architectures. This enables:

- **Schema Reuse**: Define common schema patterns that can be referenced across multiple CALM components
- **Company Customization**: Organizations can define their own validation rules and schema patterns
- **Domain Standards**: Industry-specific schema fragments (e.g., NIST compliance frameworks, financial services regulations)
- **Validation Enforcement**: Standards are enforced through patterns or custom rules via the validator plugin

## Usage Intent (Implementation TBD)

The exact JSON Schema mechanism for how Standards work is not yet defined, but the intent is to support scenarios like:

### Example 1: Company Node Requirements
A company could define standard fields that all their nodes must include, such as cost centers, ownership information, or compliance classifications.

### Example 2: Security Control Frameworks  
Organizations could define Standards that align with frameworks like NIST CSF, requiring specific properties and validation rules for security controls.

### Example 3: Integration Patterns
Common interface patterns could be defined as Standards that teams can reference when creating integrations.

## Implementation Areas

Standards are planned for implementation across CALM Hub with the API structure:

- **Storage**: `calm/namespace/{namespace}/standards`
- **Versioning**: Support for multiple versions of standards
- **Enforcement**: Integration with patterns and validator plugins
- **Discovery**: Organizations can browse and adopt standards from different namespaces

## Documentation Tasks

### Primary Task
1. **Create Standards Documentation**: Add comprehensive documentation explaining:
   - What Standards are and why they're needed
   - How Standards relate to JSON Schema validation
   - Integration with patterns and validation workflows
   - Best practices for organizational adoption
   - API reference for CalmHub Standards endpoints

### Secondary Task  
2. **CALM Chat Mode Integration**: Add Standards guidance to CALM AI assistance:
   - Create `standards-creation.md` tool prompt
   - Add Standards concept to existing tool prompts where relevant
   - Update CALM chatmode instructions to include Standards
   - Provide examples of using Standards in architecture modeling

## Implementation Priority

**Priority**: Medium - This provides important context for users adopting CALM in organizational settings where schema customization is required.

**Target Location**: 
- Main documentation: `/docs/docs/working-with-calm/standards.md`
- AI tool prompt: `/calm-ai/tools/standards-creation.md`
- Schema reference: Update relevant schema documentation

## Success Criteria

- [ ] Clear documentation explaining Standards concept and usage
- [ ] Examples showing how Standards integrate with CALM validation
- [ ] Integration with CALM Chat Mode AI assistance  
- [ ] API documentation for CalmHub Standards endpoints
- [ ] Best practices guide for organizational adoption

## Related Issues

- [#713 - CalmHub: Introduce Controls](https://github.com/finos/architecture-as-code/issues/713)
- [#1231 - CalmHub: Standards](https://github.com/finos/architecture-as-code/issues/1231)