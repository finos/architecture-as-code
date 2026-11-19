package org.finos.calm.domain;

/** A resource identifier for MongoDB and standalone (NitriteDB) storage. */
public record NumericResourceId(int value) implements ResourceId {
}
