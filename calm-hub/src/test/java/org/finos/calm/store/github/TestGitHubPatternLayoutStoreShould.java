package org.finos.calm.store.github;

import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

@ExtendWith(MockitoExtension.class)
class TestGitHubPatternLayoutStoreShould {

    private GitHubPatternLayoutStore store;

    @BeforeEach
    void setup() {
        store = new GitHubPatternLayoutStore();
    }

    @Test
    void return_empty_optional_for_get_layout() throws NamespaceNotFoundException {
        Optional<String> result = store.getLayout("finos", 1);

        assertThat(result, equalTo(Optional.empty()));
    }

    @Test
    void no_op_on_upsert_layout() {
        assertDoesNotThrow(() -> store.upsertLayout("finos", 1, "{\"nodes\":[]}"));
    }

    @Test
    void return_empty_list_for_pattern_ids_with_layout() throws NamespaceNotFoundException {
        List<Integer> result = store.getPatternIdsWithLayoutForNamespace("finos");

        assertThat(result, is(empty()));
    }
}
