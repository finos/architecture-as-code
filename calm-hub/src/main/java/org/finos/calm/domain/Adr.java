package org.finos.calm.domain;

import io.soabase.recordbuilder.core.RecordBuilder;

@RecordBuilder.Options(enableWither = false)
@RecordBuilder
public record Adr(String namespace, int id, int revision, String adr) {

}
