package org.finos.calm.model.canonical;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class CalmConnectsSchema {
    private CalmNodeInterfaceSchema source;
    private CalmNodeInterfaceSchema destination;

    public CalmNodeInterfaceSchema getSource() { return source; }
    public CalmNodeInterfaceSchema getDestination() { return destination; }
}
