package org.finos.calm.store;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;

public class TestUserAccessStoreShould {

    @Test
    void return_no_group_grants_by_default() {
        UserAccessStore store = Mockito.mock(UserAccessStore.class, Mockito.CALLS_REAL_METHODS);

        assertThat(store.getGroupGrantsForNamespaces(List.of("finos")), empty());
        assertThat(store.getGroupGrantsForDomain("security"), empty());
        assertThat(store.getAllGroupGrants(), empty());
    }
}
