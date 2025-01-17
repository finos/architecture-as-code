package org.finos.calm.domain.adr;

import io.soabase.recordbuilder.core.RecordBuilder;

import java.util.List;

@RecordBuilder.Options(enableWither = false)
@RecordBuilder
public record NewAdr(
    String title,
    String contextAndProblemStatement,
    List<String> decisionDrivers,
    List<AdrOption> consideredOptions,
    AdrDecision decisionOutcome,
    List<AdrLink> links
) {
}
