package org.finos.calm.domain.timeline;

import jakarta.validation.constraints.NotBlank;
import java.util.Objects;

public class CreateTimelineRequest {
    @NotBlank(message = "Name must not be blank")
    private String name;
    private String description;
    @NotBlank(message = "Timeline JSON must not be blank")
    private String timelineJson;

    public CreateTimelineRequest(String name, String description, String timelineJson) {
        this.name = name;
        this.description = description;
        this.timelineJson = timelineJson;
    }

    public CreateTimelineRequest() {
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

    public String getTimelineJson() {
        return timelineJson;
    }

    public void setTimelineJson(String timelineJson) {
        this.timelineJson = timelineJson;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        CreateTimelineRequest that = (CreateTimelineRequest) o;
        return Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(timelineJson, that.timelineJson);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description, timelineJson);
    }
}
