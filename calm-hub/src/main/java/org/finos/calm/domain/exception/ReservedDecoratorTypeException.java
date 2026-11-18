package org.finos.calm.domain.exception;

public class ReservedDecoratorTypeException extends Exception {
    private final String type;

    public ReservedDecoratorTypeException(String type) {
        super("Decorator type is reserved: " + type);
        this.type = type;
    }

    public String getType() {
        return type;
    }
}
