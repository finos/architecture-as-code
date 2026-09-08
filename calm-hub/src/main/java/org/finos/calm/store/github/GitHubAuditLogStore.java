package org.finos.calm.store.github;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.finos.calm.domain.audit.AuditLogEntry;
import org.finos.calm.domain.audit.AuditLogQuery;
import org.finos.calm.store.AuditLogStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * No-op audit store for GitHub mode. Audit trail is captured by
 * AuditRequestFilter + OTEL structured logging — no database persistence needed.
 */
@ApplicationScoped
@Typed(GitHubAuditLogStore.class)
public class GitHubAuditLogStore implements AuditLogStore {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubAuditLogStore.class);

    @Override
    public void record(AuditLogEntry entry) {
        LOG.debug("Audit (log-only): user={} action={} entityType={}",
                entry.getActor(), entry.getAction(), entry.getEntityType());
    }

    @Override
    public List<AuditLogEntry> query(AuditLogQuery query) {
        return List.of();
    }
}
