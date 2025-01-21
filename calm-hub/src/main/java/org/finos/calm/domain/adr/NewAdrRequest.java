package org.finos.calm.domain.adr;

import io.soabase.recordbuilder.core.RecordBuilder;

import java.util.List;

@RecordBuilder.Options(enableWither = false)
@RecordBuilder
public record NewAdrRequest(
    String title,
    String contextAndProblemStatement,
    List<String> decisionDrivers,
    List<Option> consideredOptions,
    Decision decisionOutcome,
    List<Link> links
) {
}
