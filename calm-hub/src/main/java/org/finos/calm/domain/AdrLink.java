package org.finos.calm.domain;

import io.soabase.recordbuilder.core.RecordBuilder;

@RecordBuilder.Options(enableWither = false)
@RecordBuilder
public record AdrLink(String rel, String href) {
}
