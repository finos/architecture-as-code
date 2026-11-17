package org.finos.calm.security;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.audit.AuditLogEntry;
import org.finos.calm.store.AuditLogStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static org.finos.calm.resources.ResourceValidationConstants.STRICT_SANITIZATION_POLICY;

/**
 * Single write-in point for the audit trail. Independently persists an
 * {@link AuditLogEntry} to the {@link AuditLogStore} and/or emits it as a
 * structured log line, gated by two independent toggles:
 *
 * <ul>
 *   <li>{@code calm.audit.store.enabled} (default {@code true}) — write to the
 *       {@link AuditLogStore}</li>
 *   <li>{@code calm.audit.log.enabled} (default {@code true}) — emit a structured
 *       log line under the {@code org.finos.calm.audit} logger category, so operators
 *       can route it to a separate file/SIEM sink independently of the general
 *       {@code org.finos.calm} category</li>
 * </ul>
 *
 * <p>Both toggles are read via {@link ConfigProvider} in {@link #init()} rather than
 * {@code @ConfigProperty} field injection — the same native-image-safe pattern used by
 * {@link ReadOnlyRequestFilter}, since {@code @ConfigProperty} values on CDI beans are
 * captured at native-image build time and would ignore a runtime env var override.</p>
 *
 * <p>A failure writing to the store (e.g. Mongo transiently unavailable) is caught and
 * logged, never propagated — the audit trail must never block or fail the mutating
 * request it is recording.</p>
 */
@ApplicationScoped
public class AuditService {

    private static final Logger LOG = LoggerFactory.getLogger(AuditService.class);
    private static final Logger AUDIT_LOG = LoggerFactory.getLogger("org.finos.calm.audit");

    private final AuditLogStore auditLogStore;

    @Inject
    public AuditService(AuditLogStore auditLogStore) {
        this.auditLogStore = auditLogStore;
    }

    // Resolved once at runtime startup via @PostConstruct — see the class javadoc for why
    // @ConfigProperty field injection is deliberately avoided here.
    // Package-private so unit tests can override the resolved values.
    boolean storeEnabled;
    boolean logEnabled;

    @PostConstruct
    void init() {
        storeEnabled = ConfigProvider.getConfig()
                .getOptionalValue("calm.audit.store.enabled", Boolean.class)
                .orElse(true);
        logEnabled = ConfigProvider.getConfig()
                .getOptionalValue("calm.audit.log.enabled", Boolean.class)
                .orElse(true);
        boolean authEnabled = ConfigProvider.getConfig()
                .getOptionalValue("calm.auth.enabled", Boolean.class)
                .orElse(false);
        if (!authEnabled && (storeEnabled || logEnabled)) {
            LOG.warn("CalmHub is running with authentication disabled (no-auth mode). "
                    + "Audit records will show every actor as the shared 'no-auth' principal "
                    + "and are not attributable to an individual user.");
        }
    }

    /**
     * Records an audit entry per the {@code calm.audit.store.enabled}/{@code calm.audit.log.enabled}
     * toggles. Never throws — a failure recording the entry is logged and swallowed.
     */
    public void record(AuditLogEntry entry) {
        if (storeEnabled) {
            try {
                auditLogStore.record(entry);
            } catch (Exception e) {
                LOG.warn("Failed to persist audit log entry: {}", sanitizedSummary(entry), e);
            }
        }
        if (logEnabled) {
            try {
                AUDIT_LOG.info("AUDIT actor=[{}] action=[{}] entityType=[{}] namespace=[{}] domain=[{}] "
                                + "entityId=[{}] version=[{}] outcome=[{}] sourceIp=[{}] timestamp=[{}]{}",
                        sanitize(entry.getActor()), entry.getAction(), entry.getEntityType(),
                        sanitize(entry.getNamespace()), sanitize(entry.getDomain()), sanitize(entry.getEntityId()),
                        sanitize(entry.getVersion()), entry.getOutcome(), sanitize(entry.getSourceIp()),
                        entry.getTimestamp(), extensionFields(entry));
            } catch (Exception e) {
                LOG.warn("Failed to emit audit log line: {}", sanitizedSummary(entry), e);
            }
        }
    }

    /** Empty for other entity types, so that their log line does not change. */
    private static String extensionFields(AuditLogEntry entry) {
        if (entry.getRoute() == null && entry.getJti() == null) {
            return "";
        }
        return " route=[" + sanitize(entry.getRoute()) + "] jti=[" + sanitize(entry.getJti()) + "]";
    }

    /**
     * Every field here can originate from user-controlled input (path segments, a
     * Location header built from them, the {@code X-Forwarded-For} header for
     * {@code sourceIp}) — sanitize before it reaches a log line, per
     * calm-hub/AGENTS.md's XSS-prevention rule. {@code null}-safe since most fields
     * are optional depending on entity type/outcome.
     */
    private static String sanitize(String value) {
        return value == null ? null : STRICT_SANITIZATION_POLICY.sanitize(value);
    }

    private static String sanitizedSummary(AuditLogEntry entry) {
        return "AuditLogEntry{actor=" + sanitize(entry.getActor())
                + ", action=" + entry.getAction()
                + ", entityType=" + entry.getEntityType()
                + ", namespace=" + sanitize(entry.getNamespace())
                + ", domain=" + sanitize(entry.getDomain())
                + ", entityId=" + sanitize(entry.getEntityId())
                + ", version=" + sanitize(entry.getVersion())
                + ", outcome=" + entry.getOutcome()
                + ", sourceIp=" + sanitize(entry.getSourceIp())
                + ", timestamp=" + entry.getTimestamp() + extensionFields(entry) + "}";
    }
}
