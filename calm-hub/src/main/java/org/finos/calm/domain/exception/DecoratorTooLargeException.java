package org.finos.calm.domain.exception;

import org.finos.calm.domain.SchemaValidationLimits;

/**
 * A decorator write is larger than {@value SchemaValidationLimits#MAX_DECORATOR_JSON_BYTES} bytes of UTF-8 JSON.
 */
public class DecoratorTooLargeException extends Exception {

    public DecoratorTooLargeException() {
        super("Decorator JSON is larger than " + SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES + " bytes");
    }
}
