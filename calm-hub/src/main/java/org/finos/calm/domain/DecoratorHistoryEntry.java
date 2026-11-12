package org.finos.calm.domain;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.Objects;

/**
 * One decorator in the history of a reserved-type decorator. {@code supersedes} and
 * {@code supersededBy} are Hub-owned and stored outside the decorator itself.
 *
 * <p>Immutable</p>
 */
@RegisterForReflection
public class DecoratorHistoryEntry {
    private final int id;
    private final Integer supersedes;
    private final Integer supersededBy;
    private final Decorator decorator;

    public DecoratorHistoryEntry(int id, Integer supersedes, Integer supersededBy, Decorator decorator) {
        this.id = id;
        this.supersedes = supersedes;
        this.supersededBy = supersededBy;
        this.decorator = decorator;
    }

    public int getId() {
        return id;
    }

    public Integer getSupersedes() {
        return supersedes;
    }

    public Integer getSupersededBy() {
        return supersededBy;
    }

    public Decorator getDecorator() {
        return decorator;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        DecoratorHistoryEntry that = (DecoratorHistoryEntry) o;
        return id == that.id
                && Objects.equals(supersedes, that.supersedes)
                && Objects.equals(supersededBy, that.supersededBy)
                && Objects.equals(decorator, that.decorator);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, supersedes, supersededBy, decorator);
    }

    @Override
    public String toString() {
        return "DecoratorHistoryEntry{" +
                "id=" + id +
                ", supersedes=" + supersedes +
                ", supersededBy=" + supersededBy +
                ", decorator=" + decorator +
                '}';
    }
}
