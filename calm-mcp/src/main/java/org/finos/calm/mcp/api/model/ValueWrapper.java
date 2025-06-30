package org.finos.calm.mcp.api.model;

import java.util.List;

/**
 * Wrapper class for a list of values, this is used to wrap a list of values and provide the option to paginate results later
 *
 * @param <T> the type of the values
 */
public class ValueWrapper<T> {
    private List<T> values;

    public ValueWrapper(List<T> values) {
        this.values = values;
    }

    public List<T> getValues() {
        return values;
    }
}
