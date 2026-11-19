package org.finos.calm.domain.search;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.quarkus.runtime.annotations.RegisterForReflection;
import org.finos.calm.domain.Tags;

import java.util.Objects;

// Returned via an opaque Response, so without this the native image strips its
// reflection metadata and Jackson serializes it as {}.
@RegisterForReflection
public class SearchResult {
    private final String namespace;
    private final String id;
    private final String name;
    private final String description;
    private final Tags tags;

    public SearchResult(String namespace, String id, String name, String description) {
        this(namespace, id, name, description, null);
    }

    public SearchResult(String namespace, String id, String name, String description, Tags tags) {
        this.namespace = namespace;
        this.id = id;
        this.name = name;
        this.description = description;
        this.tags = tags;
    }

    public String getNamespace() {
        return namespace;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public Tags getTags() {
        return tags;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        SearchResult that = (SearchResult) o;
        return Objects.equals(id, that.id)
                && Objects.equals(namespace, that.namespace)
                && Objects.equals(name, that.name)
                && Objects.equals(description, that.description)
                && Objects.equals(tags, that.tags);
    }

    @Override
    public int hashCode() {
        return Objects.hash(namespace, id, name, description, tags);
    }
}
