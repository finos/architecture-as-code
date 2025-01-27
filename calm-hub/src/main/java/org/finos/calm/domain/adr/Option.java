package org.finos.calm.domain.adr;

import java.util.List;

public record Option(String name, String description, List<String> positiveConsequences, List<String> negativeConsequences) {
}
