package org.finos.calm.domain.timeline;

import java.util.Objects;

/**
 * Represents an explicit timeline and the associated namespace, id, and version.
 * The timeline is represented as a String in JSON format (an opaque {@code .timeline.json} blob).
 *
 * <p>Immutable</p>
 */
public class Timeline {
    private final String namespace;
    private final int id;
    private final String version;
    private final String timeline;
    private final String name;
    private final String description;

    private Timeline(TimelineBuilder builder) {
        this.namespace = builder.namespace;
        this.id = builder.id;
        this.version = builder.version;
        this.timeline = builder.timeline;
        this.name = builder.name;
        this.description = builder.description;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getNamespace() {
        return namespace;
    }

    public int getId() {
        return id;
    }

    public String getDotVersion() {
        return version;
    }

    public String getMongoVersion() {
        return version.replace('.', '-');
    }

    public String getTimelineJson() {
        return timeline;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Timeline that = (Timeline) o;
        return id == that.id && Objects.equals(namespace, that.namespace) && Objects.equals(version, that.version) && Objects.equals(timeline, that.timeline);
    }

    @Override
    public int hashCode() {
        return Objects.hash(namespace, id, version, timeline);
    }

    @Override
    public String toString() {
        return "Timeline{" +
                "namespace='" + namespace + '\'' +
                ", id=" + id +
                ", version='" + version + '\'' +
                ", timeline='" + timeline + '\'' +
                '}';
    }

    public static class TimelineBuilder {
        private String namespace;
        private int id;
        private String version;
        private String timeline;
        private String name;
        private String description;

        public TimelineBuilder setName(String name) {
            this.name = name;
            return this;
        }

        public TimelineBuilder setDescription(String description) {
            this.description = description;
            return this;
        }

        public TimelineBuilder setNamespace(String namespace) {
            this.namespace = namespace;
            return this;
        }

        public TimelineBuilder setId(int id) {
            this.id = id;
            return this;
        }

        public TimelineBuilder setVersion(String version) {
            this.version = version;
            return this;
        }

        public TimelineBuilder setTimeline(String timeline) {
            this.timeline = timeline;
            return this;
        }

        public Timeline build() {
            return new Timeline(this);
        }
    }
}
