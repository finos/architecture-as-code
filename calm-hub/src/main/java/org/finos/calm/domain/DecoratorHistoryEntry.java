package org.finos.calm.domain;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.Objects;

/**
 * One decorator in the history of a reserved-type decorator. {@code supersedes}, {@code supersededBy} and
 * {@code supersededDateTime} are Hub-owned and stored outside the decorator itself.
 *
 * <p>Immutable</p>
 */
@RegisterForReflection
public class DecoratorHistoryEntry {
    private final int id;
    private final Integer supersedes;
    private final Integer supersededBy;
    private final String supersededDateTime;
    private final Decorator decorator;

    public DecoratorHistoryEntry(int id, Integer supersedes, Integer supersededBy, Decorator decorator) {
        this(id, supersedes, supersededBy, null, decorator);
    }

    public DecoratorHistoryEntry(int id, Integer supersedes, Integer supersededBy, String supersededDateTime, Decorator decorator) {
        this.id = id;
        this.supersedes = supersedes;
        this.supersededBy = supersededBy;
        this.supersededDateTime = supersededDateTime;
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

    /**
     * The time this entry was superseded. The superseded decorator keeps its own {@code updateDateTime}, which
     * stays the time its content was last written.
     */
    public String getSupersededDateTime() {
        return supersededDateTime;
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
                && Objects.equals(supersededDateTime, that.supersededDateTime)
                && Objects.equals(decorator, that.decorator);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, supersedes, supersededBy, supersededDateTime, decorator);
    }

    @Override
    public String toString() {
        return "DecoratorHistoryEntry{" +
                "id=" + id +
                ", supersedes=" + supersedes +
                ", supersededBy=" + supersededBy +
                ", supersededDateTime='" + supersededDateTime + '\'' +
                ", decorator=" + decorator +
                '}';
    }
}
