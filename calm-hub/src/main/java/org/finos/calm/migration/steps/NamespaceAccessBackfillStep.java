package org.finos.calm.migration.steps;

import io.quarkus.arc.lookup.LookupUnlessProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.migration.SchemaMigrationStep;
import org.finos.calm.store.NamespaceStore;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * Backfills a {@code * read} grant on every namespace that has no grants at all,
 * ensuring existing namespaces remain publicly readable after the hierarchical
 * entitlement model is deployed.
 *
 * <p>This is a {@link SchemaMigrationStep}, run once by
 * {@code org.finos.calm.migration.SchemaMigrationRunner} as part of the version 1 → 2
 * schema migration. The operation is idempotent — if a namespace already has
 * <em>any</em> existing grant (wildcard or named-user), it is skipped on the assumption
 * that an administrator has intentionally configured access for that namespace.
 * Uses the CDI-produced {@link NamespaceStore} and {@link UserAccessStore} interfaces
 * so it works for both MongoDB and Nitrite backends without duplication.
 */
@LookupUnlessProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class NamespaceAccessBackfillStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(NamespaceAccessBackfillStep.class);

    private final NamespaceStore namespaceStore;
    private final UserAccessStore userAccessStore;

    @Inject
    public NamespaceAccessBackfillStep(NamespaceStore namespaceStore, UserAccessStore userAccessStore) {
        this.namespaceStore = namespaceStore;
        this.userAccessStore = userAccessStore;
    }

    @Override
    public int fromVersion() {
        return 1;
    }

    @Override
    public void apply() {
        LOG.info("Running namespace migration: backfilling * read grants on existing namespaces");
        List<NamespaceInfo> namespaces = namespaceStore.getNamespaces();
        int backfilled = 0;
        for (NamespaceInfo ns : namespaces) {
            if (backfillIfNeeded(ns.getName())) {
                backfilled++;
            }
        }
        LOG.info("Namespace migration complete: {} namespace(s) backfilled", backfilled);
    }

    boolean backfillIfNeeded(String namespace) {
        try {
            List<UserAccess> existing = userAccessStore.getUserAccessForNamespace(namespace);
            if (!existing.isEmpty()) {
                // Namespace has explicit grants — admin configured access intentionally, do not add * read
                LOG.debug("Namespace [{}] has {} existing grant(s) — skipping", namespace, existing.size());
                return false;
            }
        } catch (NamespaceNotFoundException e) {
            LOG.warn("Namespace [{}] not found during migration — skipping", namespace);
            return false;
        }

        try {
            userAccessStore.createUserAccessForNamespace(
                    new UserAccess("*", UserAccess.Permission.read, namespace));
            LOG.info("Backfilled * read grant for namespace [{}]", namespace);
            return true;
        } catch (NamespaceNotFoundException e) {
            LOG.warn("Could not backfill * read grant for namespace [{}] — namespace disappeared", namespace);
            return false;
        }
    }
}
