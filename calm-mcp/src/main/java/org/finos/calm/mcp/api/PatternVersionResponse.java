package org.finos.calm.mcp.api;

import java.util.List;

public class PatternVersionResponse {
    private List<String> values;

    public PatternVersionResponse() {}

    public PatternVersionResponse(List<String> values) {
        this.values = values;
    }

    public List<String> getValues() {
        return values;
    }

    public void setValues(List<String> values) {
        this.values = values;
    }
}
