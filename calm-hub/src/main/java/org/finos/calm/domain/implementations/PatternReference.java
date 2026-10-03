package org.finos.calm.domain.implementations;

import io.quarkus.runtime.annotations.RegisterForReflection;

/** The pattern version a lookup was asked about, echoed back so a response stands on its own. */
@RegisterForReflection
public class PatternReference {

    private final String namespace;
    private final String name;
    private final String version;

    public PatternReference(String namespace, String name, String version) {
        this.namespace = namespace;
        this.name = name;
        this.version = version;
    }

    public String getNamespace() {
        return namespace;
    }

    public String getName() {
        return name;
    }

    public String getVersion() {
        return version;
    }
}
