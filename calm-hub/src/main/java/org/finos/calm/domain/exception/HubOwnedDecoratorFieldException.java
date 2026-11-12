package org.finos.calm.domain.exception;

public class HubOwnedDecoratorFieldException extends Exception {
    private final String field;

    public HubOwnedDecoratorFieldException(String field) {
        super("Decorator field is set by Hub and may not be sent: " + field);
        this.field = field;
    }

    public String getField() {
        return field;
    }
}
