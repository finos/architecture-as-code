package org.finos.calm.domain.namespaces;

import jakarta.json.bind.annotation.JsonbPropertyOrder;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@JsonbPropertyOrder({"name", "description"})
public class NamespaceInfo {
    @NotNull(message = "Name must not be null")
    @NotBlank(message = "Name must not be blank")
    private final String name;
    private final String description;

    public NamespaceInfo(String name, String description) {
        this.name = name;
        this.description = description;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

}
