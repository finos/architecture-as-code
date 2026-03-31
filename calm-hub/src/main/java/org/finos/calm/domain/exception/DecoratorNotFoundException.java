package org.finos.calm.domain.exception;

public class DecoratorNotFoundException extends Exception {
    public DecoratorNotFoundException() {
        super("Decorator not found");
    }
}
