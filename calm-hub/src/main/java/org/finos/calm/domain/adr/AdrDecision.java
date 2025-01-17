package org.finos.calm.domain.adr;

import io.soabase.recordbuilder.core.RecordBuilder;

@RecordBuilder.Options(enableWither = false)
@RecordBuilder
public record AdrDecision(AdrOption chosenOption, String rationale) {
}
