package org.finos.calm.domain.namespaces;

import jakarta.json.bind.annotation.JsonbPropertyOrder;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Objects;

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

    @Override
    public boolean equals(Object o) {
        if(o == null || getClass() != o.getClass()) return false;
        NamespaceInfo that = (NamespaceInfo) o;
        return Objects.equals(name, that.name) && Objects.equals(description, that.description);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description);
    }
}
