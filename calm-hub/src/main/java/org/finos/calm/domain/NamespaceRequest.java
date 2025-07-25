package org.finos.calm.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_REGEX;

public class NamespaceRequest {
    @Pattern(regexp= NAMESPACE_REGEX, message = NAMESPACE_MESSAGE)
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
