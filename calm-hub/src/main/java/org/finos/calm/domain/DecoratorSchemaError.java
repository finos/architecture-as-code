package org.finos.calm.domain;

/**
 * One error from validating a decorator against its {@code $schema}.
 *
 * @param location JSON Pointer to the failing value in the decorator
 * @param error    what is wrong with it
 */
public record DecoratorSchemaError(String location, String error) {
}
