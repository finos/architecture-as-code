package org.finos.calm.domain.adr;

import io.soabase.recordbuilder.core.RecordBuilder;

import java.util.List;

@RecordBuilder.Options(enableWither = false)
@RecordBuilder
public record AdrOption(String name, String description, List<String> positiveConsequences, List<String> negativeConsequences) {
}
