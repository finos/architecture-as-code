package org.finos.calm.domain.configs;

/**
 * One error from validating a config against the schema of its type.
 *
 * @param location JSON Pointer to the failing value in the config
 * @param error    what is wrong with it
 */
public record ConfigSchemaError(String location, String error) {
}
