package org.finos.calm.domain.adr;

import io.soabase.recordbuilder.core.RecordBuilder;

@RecordBuilder.Options(enableWither = false)
@RecordBuilder
public record Link(String rel, String href) {
}
