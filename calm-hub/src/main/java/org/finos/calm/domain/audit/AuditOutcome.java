package org.finos.calm.domain.audit;

/** The result of an audited request. UNKNOWN means the upstream result is uncertain. */
public enum AuditOutcome {
    SUCCESS,
    DENIED,
    FAILURE,
    UNKNOWN
}
