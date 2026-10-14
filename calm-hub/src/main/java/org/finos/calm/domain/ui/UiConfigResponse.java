package org.finos.calm.domain.ui;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.List;

/**
 * Body of {@code GET /api/calm/ui/config}. A null section is left out of the JSON, which tells
 * the UI that the operator did not configure or enable it.
 */
@RegisterForReflection
public record UiConfigResponse(Environment environment, Identity identity, List<Item> items) {

    @RegisterForReflection
    public record Environment(String name, String colour) {}

    @RegisterForReflection
    public record Identity(String name, List<String> roles) {}

    @RegisterForReflection
    public record Item(String label, String value, String url) {}
}
