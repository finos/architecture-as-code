package org.finos.calm.domain.adr;

import java.util.List;

public record NewAdrRequest(
    String title,
    String contextAndProblemStatement,
    List<String> decisionDrivers,
    List<Option> consideredOptions,
    Decision decisionOutcome,
    List<Link> links
) {
}
