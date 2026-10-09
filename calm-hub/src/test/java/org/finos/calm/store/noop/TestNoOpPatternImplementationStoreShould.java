package org.finos.calm.store.noop;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.store.PageRequest;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestNoOpPatternImplementationStoreShould {

    @Test
    void refuse_rather_than_report_that_nothing_implements_the_pattern() {
        GitHubWriteNotSupportedException ex = assertThrows(GitHubWriteNotSupportedException.class,
                () -> new NoOpPatternImplementationStore().findImplementations(
                        "finos", "api-gateway", "1.0.0", Optional.empty(), PageRequest.UNPAGED));
        assertThat(ex.getMessage(), containsString("GitHub storage mode"));
    }
}
