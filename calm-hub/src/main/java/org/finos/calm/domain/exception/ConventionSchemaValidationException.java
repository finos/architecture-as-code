package org.finos.calm.domain.exception;

import org.finos.calm.domain.SchemaValidationLimits;
import org.finos.calm.domain.conventions.ConventionSchemaError;

import java.util.List;

/**
 * A convention does not match the schema of its type. It keeps the first {@value SchemaValidationLimits#MAX_ERRORS} errors.
 */
public class ConventionSchemaValidationException extends Exception {
    private final List<ConventionSchemaError> errors;
    private final int moreErrors;

    public ConventionSchemaValidationException(List<ConventionSchemaError> errors) {
        super("Convention does not match the schema of its type");
        this.errors = List.copyOf(errors.subList(0, Math.min(errors.size(), SchemaValidationLimits.MAX_ERRORS)));
        this.moreErrors = errors.size() - this.errors.size();
    }

    public List<ConventionSchemaError> getErrors() {
        return errors;
    }

    public int getMoreErrors() {
        return moreErrors;
    }
}
