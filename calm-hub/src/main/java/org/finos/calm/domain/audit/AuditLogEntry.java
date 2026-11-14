package org.finos.calm.domain.audit;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * A single audit record for a mutating CalmHub request.
 *
 * <p>{@code namespace} and {@code domain} are mutually exclusive — namespace-scoped
 * entities populate {@code namespace}, domain-scoped entities (controls, domain-level
 * user access) populate {@code domain}, and global entities (namespace/domain/schema
 * creation) populate neither. {@code version} is {@code null} for unversioned entities
 * (e.g. user access grants).</p>
 *
 * <p>{@code route} and {@code jti} are set only for {@code EXTENSION} entries: the route id, and the
 * id of the identity assertion that Hub sent to the extension. {@code entityId} is then the extension id.</p>
 */
public class AuditLogEntry {

    @JsonDeserialize(using = LocalDateTimeDeserializer.class)
    @JsonSerialize(using = LocalDateTimeSerializer.class)
    private LocalDateTime timestamp;

    private String actor;
    private AuditAction action;
    private AuditEntityType entityType;
    private String namespace;
    private String domain;
    private String entityId;
    private String version;
    private AuditOutcome outcome;
    private String sourceIp;
    private String route;
    private String jti;

    public AuditLogEntry() {
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public String getActor() {
        return actor;
    }

    public void setActor(String actor) {
        this.actor = actor;
    }

    public AuditAction getAction() {
        return action;
    }

    public void setAction(AuditAction action) {
        this.action = action;
    }

    public AuditEntityType getEntityType() {
        return entityType;
    }

    public void setEntityType(AuditEntityType entityType) {
        this.entityType = entityType;
    }

    public String getNamespace() {
        return namespace;
    }

    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    public String getDomain() {
        return domain;
    }

    public void setDomain(String domain) {
        this.domain = domain;
    }

    public String getEntityId() {
        return entityId;
    }

    public void setEntityId(String entityId) {
        this.entityId = entityId;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public AuditOutcome getOutcome() {
        return outcome;
    }

    public void setOutcome(AuditOutcome outcome) {
        this.outcome = outcome;
    }

    public String getSourceIp() {
        return sourceIp;
    }

    public void setSourceIp(String sourceIp) {
        this.sourceIp = sourceIp;
    }

    public String getRoute() {
        return route;
    }

    public void setRoute(String route) {
        this.route = route;
    }

    public String getJti() {
        return jti;
    }

    public void setJti(String jti) {
        this.jti = jti;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        AuditLogEntry that = (AuditLogEntry) o;
        return Objects.equals(timestamp, that.timestamp)
                && Objects.equals(actor, that.actor)
                && action == that.action
                && entityType == that.entityType
                && Objects.equals(namespace, that.namespace)
                && Objects.equals(domain, that.domain)
                && Objects.equals(entityId, that.entityId)
                && Objects.equals(version, that.version)
                && outcome == that.outcome
                && Objects.equals(sourceIp, that.sourceIp)
                && Objects.equals(route, that.route)
                && Objects.equals(jti, that.jti);
    }

    @Override
    public int hashCode() {
        return Objects.hash(timestamp, actor, action, entityType, namespace, domain, entityId, version, outcome, sourceIp, route, jti);
    }

    @Override
    public String toString() {
        return "AuditLogEntry{" +
                "timestamp=" + timestamp +
                ", actor='" + actor + '\'' +
                ", action=" + action +
                ", entityType=" + entityType +
                ", namespace='" + namespace + '\'' +
                ", domain='" + domain + '\'' +
                ", entityId='" + entityId + '\'' +
                ", version='" + version + '\'' +
                ", outcome=" + outcome +
                ", sourceIp='" + sourceIp + '\'' +
                ", route='" + route + '\'' +
                ", jti='" + jti + '\'' +
                '}';
    }

    public static class AuditLogEntryBuilder {

        private LocalDateTime timestamp;
        private String actor;
        private AuditAction action;
        private AuditEntityType entityType;
        private String namespace;
        private String domain;
        private String entityId;
        private String version;
        private AuditOutcome outcome;
        private String sourceIp;
        private String route;
        private String jti;

        public AuditLogEntryBuilder setTimestamp(LocalDateTime timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        public AuditLogEntryBuilder setActor(String actor) {
            this.actor = actor;
            return this;
        }

        public AuditLogEntryBuilder setAction(AuditAction action) {
            this.action = action;
            return this;
        }

        public AuditLogEntryBuilder setEntityType(AuditEntityType entityType) {
            this.entityType = entityType;
            return this;
        }

        public AuditLogEntryBuilder setNamespace(String namespace) {
            this.namespace = namespace;
            return this;
        }

        public AuditLogEntryBuilder setDomain(String domain) {
            this.domain = domain;
            return this;
        }

        public AuditLogEntryBuilder setEntityId(String entityId) {
            this.entityId = entityId;
            return this;
        }

        public AuditLogEntryBuilder setVersion(String version) {
            this.version = version;
            return this;
        }

        public AuditLogEntryBuilder setOutcome(AuditOutcome outcome) {
            this.outcome = outcome;
            return this;
        }

        public AuditLogEntryBuilder setSourceIp(String sourceIp) {
            this.sourceIp = sourceIp;
            return this;
        }

        public AuditLogEntryBuilder setRoute(String route) {
            this.route = route;
            return this;
        }

        public AuditLogEntryBuilder setJti(String jti) {
            this.jti = jti;
            return this;
        }

        public AuditLogEntry build() {
            AuditLogEntry entry = new AuditLogEntry();
            entry.timestamp = this.timestamp;
            entry.actor = this.actor;
            entry.action = this.action;
            entry.entityType = this.entityType;
            entry.namespace = this.namespace;
            entry.domain = this.domain;
            entry.entityId = this.entityId;
            entry.version = this.version;
            entry.outcome = this.outcome;
            entry.sourceIp = this.sourceIp;
            entry.route = this.route;
            entry.jti = this.jti;
            return entry;
        }
    }
}
