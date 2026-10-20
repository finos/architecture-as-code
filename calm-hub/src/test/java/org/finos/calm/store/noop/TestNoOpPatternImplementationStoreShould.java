package org.finos.calm.store.noop;

import org.finos.calm.domain.exception.GitHubModeNotSupportedException;
import org.finos.calm.store.util.PatternReferenceMatcher;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestNoOpPatternImplementationStoreShould {

    @Test
    void refuse_rather_than_report_that_nothing_implements_the_pattern() {
        GitHubModeNotSupportedException ex = assertThrows(GitHubModeNotSupportedException.class,
                () -> new NoOpPatternImplementationStore().findSchemasContaining(
                        PatternReferenceMatcher.pathPattern("finos", "api-gateway"), Optional.empty()));
        assertThat(ex.getMessage(), containsString("GitHub storage mode"));
    }
}
