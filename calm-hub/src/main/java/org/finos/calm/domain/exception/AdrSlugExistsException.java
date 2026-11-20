package org.finos.calm.domain.exception;

/**
 * Thrown when a caller explicitly requests an ADR slug that another ADR in the namespace
 * already holds. A derived slug never raises this: it takes the next free suffix instead.
 */
public class AdrSlugExistsException extends Exception {
}
