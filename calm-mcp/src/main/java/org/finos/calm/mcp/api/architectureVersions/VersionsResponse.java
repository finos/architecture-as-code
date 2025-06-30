package org.finos.calm.mcp.api.architectureVersions;

import java.util.List;

public class VersionsResponse {
    private List<String> values;

    public List<String> getValues() {
        return values;
    }

    public void setValues(List<String> values) {
        this.values = values;
    }
}
