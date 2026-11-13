package org.finos.calm.domain.exception;

public class DecoratorSupersededException extends Exception {
    public DecoratorSupersededException() {
        super("Decorator has been superseded");
    }
}
