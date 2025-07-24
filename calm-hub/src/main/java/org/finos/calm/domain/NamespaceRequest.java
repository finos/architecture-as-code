package org.finos.calm.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public class NamespaceRequest {
    @Pattern(regexp="^[A-Za-z0-9-]+$", message = "Namespace must match pattern: ^[A-Za-z0-9-]+$")
    @NotNull(message = "Namespace must not be null")
    @NotBlank(message = "Namespace must not be blank")
    private String namespace;

    public String getNamespace() {
        return namespace;
    }

    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }
}
