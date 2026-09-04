package org.finos.calm.domain.audit;

/**
 * The kind of entity an audited request mutated.
 */
public enum AuditEntityType {
    NAMESPACE,
    ARCHITECTURE,
    PATTERN,
    CONTROL,
    CONTROL_REQUIREMENT,
    CONTROL_CONFIGURATION,
    ADR,
    DECORATOR,
    DOMAIN,
    FLOW,
    INTERFACE,
    STANDARD,
    TIMELINE,
    USER_ACCESS,
    SCHEMA,
    LAYOUT,
    PATTERN_LAYOUT,
    BUILDING_BLOCK
}
