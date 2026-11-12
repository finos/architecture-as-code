package org.finos.calm.domain.audit;

/**
 * The kind of operation an audited request performed.
 */
public enum AuditAction {
    READ,
    CREATE,
    UPDATE,
    DELETE,
    GRANT,
    REVOKE
}
