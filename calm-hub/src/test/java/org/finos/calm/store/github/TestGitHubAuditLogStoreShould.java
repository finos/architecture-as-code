package org.finos.calm.store.github;

import org.finos.calm.domain.audit.AuditLogEntry;
import org.finos.calm.domain.audit.AuditLogQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

@ExtendWith(MockitoExtension.class)
class TestGitHubAuditLogStoreShould {

    private GitHubAuditLogStore store;

    @BeforeEach
    void setup() {
        store = new GitHubAuditLogStore();
    }

    @Test
    void not_throw_on_record() {
        AuditLogEntry entry = new AuditLogEntry();
        assertDoesNotThrow(() -> store.record(entry));
    }

    @Test
    void return_empty_list_on_query() {
        AuditLogQuery query = new AuditLogQuery();

        List<AuditLogEntry> result = store.query(query);

        assertThat(result, is(empty()));
    }
}
