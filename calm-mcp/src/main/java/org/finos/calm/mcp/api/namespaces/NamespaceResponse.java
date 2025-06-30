package org.finos.calm.mcp.api.namespaces;

import java.util.List;

public class NamespaceResponse {
    private List<String> values;

    public List<String> getValues() {
        return values;
    }

    public void setValues(List<String> values) {
        this.values = values;
    }
}
