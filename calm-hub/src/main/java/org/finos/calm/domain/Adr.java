package org.finos.calm.domain;

import io.soabase.recordbuilder.core.RecordBuilder;

/**
 * Represents an ADR and the associated namespace, id, and revision.
 * The ADR is represented as a String in JSON format.
 */
@RecordBuilder.Options(enableWither = false)
@RecordBuilder
public record Adr(String namespace, int id, int revision, String adr) {

}
