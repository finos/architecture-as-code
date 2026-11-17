package org.finos.calm.domain.exception;

import org.finos.calm.domain.DecoratorSchemaError;
import org.finos.calm.domain.SchemaValidationLimits;

import java.util.List;

/**
 * A decorator does not match its {@code $schema}. It keeps the first {@value SchemaValidationLimits#MAX_ERRORS} errors, as the
 * MCP tool input check does, because the caller controls how many there are.
 */
public class DecoratorSchemaValidationException extends Exception {
    private final List<DecoratorSchemaError> errors;
    private final int moreErrors;

    public DecoratorSchemaValidationException(List<DecoratorSchemaError> errors) {
        super("Decorator does not match its $schema");
        this.errors = List.copyOf(errors.subList(0, Math.min(errors.size(), SchemaValidationLimits.MAX_ERRORS)));
        this.moreErrors = errors.size() - this.errors.size();
    }

    public List<DecoratorSchemaError> getErrors() {
        return errors;
    }

    /**
     * @return how many errors there are after the ones that {@link #getErrors()} returns
     */
    public int getMoreErrors() {
        return moreErrors;
    }
}
