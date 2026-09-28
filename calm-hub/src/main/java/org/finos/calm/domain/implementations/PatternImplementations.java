package org.finos.calm.domain.implementations;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.List;

/**
 * The answer to "which architectures implement this pattern version?".
 *
 * <p>The list holds only architectures that name the pattern themselves. An architecture records
 * its pattern only when someone generated it from a pattern fetched from this hub, so an empty
 * list can mean either "nothing implements this" or "nothing here records a pattern at all". The
 * endpoint does not distinguish them. A count of unlinkable architectures would be the same number
 * for every pattern a caller asks about, so it describes the hub rather than the pattern and does
 * not belong in this response. The write path is where that problem should surface instead.</p>
 */
@RegisterForReflection
public class PatternImplementations {

    private final PatternReference pattern;
    private final List<PatternImplementation> implementations;

    public PatternImplementations(PatternReference pattern, List<PatternImplementation> implementations) {
        this.pattern = pattern;
        this.implementations = implementations;
    }

    public PatternReference getPattern() {
        return pattern;
    }

    public List<PatternImplementation> getImplementations() {
        return implementations;
    }
}
