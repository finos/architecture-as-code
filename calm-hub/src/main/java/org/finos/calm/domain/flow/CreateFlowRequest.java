package org.finos.calm.domain.flow;

import jakarta.validation.constraints.NotBlank;
import java.util.Objects;

public class CreateFlowRequest {
    @NotBlank(message = "Name must not be blank")
    private String name;
    private String description;
    @NotBlank(message = "Flow JSON must not be blank")
    private String flowJson;

    public CreateFlowRequest(String name, String description, String flowJson) {
        this.name = name;
        this.description = description;
        this.flowJson = flowJson;
    }

    public CreateFlowRequest() {
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

    public String getFlowJson() {
        return flowJson;
    }

    public void setFlowJson(String flowJson) {
        this.flowJson = flowJson;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        CreateFlowRequest that = (CreateFlowRequest) o;
        return Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(flowJson, that.flowJson);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description, flowJson);
    }
}
