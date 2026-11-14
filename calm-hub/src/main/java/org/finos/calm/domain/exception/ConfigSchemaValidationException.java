package org.finos.calm.domain.exception;

import org.finos.calm.domain.SchemaValidationLimits;
import org.finos.calm.domain.configs.ConfigSchemaError;

import java.util.List;

/**
 * A config does not match the schema of its type. It keeps the first {@value SchemaValidationLimits#MAX_ERRORS} errors.
 */
public class ConfigSchemaValidationException extends Exception {
    private final List<ConfigSchemaError> errors;
    private final int moreErrors;

    public ConfigSchemaValidationException(List<ConfigSchemaError> errors) {
        super("Config does not match the schema of its type");
        this.errors = List.copyOf(errors.subList(0, Math.min(errors.size(), SchemaValidationLimits.MAX_ERRORS)));
        this.moreErrors = errors.size() - this.errors.size();
    }

    public List<ConfigSchemaError> getErrors() {
        return errors;
    }

    public int getMoreErrors() {
        return moreErrors;
    }
}
