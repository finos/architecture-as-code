package org.finos.calm.extensions;

import java.util.Map;

/**
 * A form submission whose input the fields do not accept. {@code fields} maps a field id to its message. The key
 * {@code ""} holds a message for the input as a whole, such as a value that no field takes.
 */
public class ExtensionFormInputException extends ExtensionProxyException {

    private final Map<String, String> fields;

    public ExtensionFormInputException(Map<String, String> fields) {
        super(422, "Check the values in the form");
        this.fields = Map.copyOf(fields);
    }

    public Map<String, String> fields() {
        return fields;
    }
}
