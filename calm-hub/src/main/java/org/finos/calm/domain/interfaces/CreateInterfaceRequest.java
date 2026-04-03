package org.finos.calm.domain.interfaces;

import jakarta.validation.constraints.NotBlank;
import java.util.Objects;

public class CreateInterfaceRequest {
    @NotBlank(message = "Name must not be blank")
    private String name;
    private String description;
    @NotBlank(message = "Interface JSON must not be blank")
    private String interfaceJson;

    public CreateInterfaceRequest(String name, String description, String interfaceJson) {
        this.name = name;
        this.description = description;
        this.interfaceJson = interfaceJson;
    }

    public CreateInterfaceRequest() {
        //Default constructor
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getInterfaceJson() {
        return interfaceJson;
    }

    public void setInterfaceJson(String interfaceJson) {
        this.interfaceJson = interfaceJson;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        CreateInterfaceRequest that = (CreateInterfaceRequest) o;
        return Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(interfaceJson, that.interfaceJson);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description, interfaceJson);
    }
}
