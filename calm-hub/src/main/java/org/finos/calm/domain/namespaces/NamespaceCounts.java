package org.finos.calm.domain.namespaces;

import jakarta.json.bind.annotation.JsonbPropertyOrder;

import java.util.Objects;

/**
 * Per-namespace, per-resource-type counts. Surfaced by
 * {@code GET /api/calm/namespaces/counts} so the browse rail and namespace page
 * can show live counts without one client round-trip per resource type.
 *
 * <p>{@code total} is the sum of the six resource-type counts.</p>
 */
@JsonbPropertyOrder({"namespace", "architectures", "patterns", "flows", "standards", "adrs", "interfaces", "total"})
public class NamespaceCounts {
    private final String namespace;
    private final int architectures;
    private final int patterns;
    private final int flows;
    private final int standards;
    private final int adrs;
    private final int interfaces;

    public NamespaceCounts(String namespace, int architectures, int patterns, int flows,
                           int standards, int adrs, int interfaces) {
        this.namespace = namespace;
        this.architectures = architectures;
        this.patterns = patterns;
        this.flows = flows;
        this.standards = standards;
        this.adrs = adrs;
        this.interfaces = interfaces;
    }

    public String getNamespace() {
        return namespace;
    }

    public int getArchitectures() {
        return architectures;
    }

    public int getPatterns() {
        return patterns;
    }

    public int getFlows() {
        return flows;
    }

    public int getStandards() {
        return standards;
    }

    public int getAdrs() {
        return adrs;
    }

    public int getInterfaces() {
        return interfaces;
    }

    public int getTotal() {
        return architectures + patterns + flows + standards + adrs + interfaces;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        NamespaceCounts that = (NamespaceCounts) o;
        return architectures == that.architectures
                && patterns == that.patterns
                && flows == that.flows
                && standards == that.standards
                && adrs == that.adrs
                && interfaces == that.interfaces
                && Objects.equals(namespace, that.namespace);
    }

    @Override
    public int hashCode() {
        return Objects.hash(namespace, architectures, patterns, flows, standards, adrs, interfaces);
    }
}
