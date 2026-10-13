package org.finos.calm.store.noop;

import org.finos.calm.domain.exception.GitHubModeNotSupportedException;
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
                        "/calm/namespaces/finos/patterns/api-gateway/versions/", Optional.empty()));
        assertThat(ex.getMessage(), containsString("GitHub storage mode"));
    }
}
