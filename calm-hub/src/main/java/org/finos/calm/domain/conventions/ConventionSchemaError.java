package org.finos.calm.domain.conventions;

/**
 * One error from validating a convention against the schema of its type.
 *
 * @param location JSON Pointer to the failing value in the convention
 * @param error    what is wrong with it
 */
public record ConventionSchemaError(String location, String error) {
}
