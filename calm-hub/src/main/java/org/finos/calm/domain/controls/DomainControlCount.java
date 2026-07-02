package org.finos.calm.domain.controls;

import jakarta.json.bind.annotation.JsonbPropertyOrder;

import java.util.Objects;

/**
 * Per-domain control count, surfaced by {@code GET /api/calm/domains/counts} so
 * the browse rail's control-domain section can show live counts without one
 * client round-trip per domain.
 */
@JsonbPropertyOrder({"domain", "controlCount"})
public class DomainControlCount {
    private final String domain;
    private final int controlCount;

    public DomainControlCount(String domain, int controlCount) {
        this.domain = domain;
        this.controlCount = controlCount;
    }

    public String getDomain() {
        return domain;
    }

    public int getControlCount() {
        return controlCount;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        DomainControlCount that = (DomainControlCount) o;
        return controlCount == that.controlCount && Objects.equals(domain, that.domain);
    }

    @Override
    public int hashCode() {
        return Objects.hash(domain, controlCount);
    }
}
