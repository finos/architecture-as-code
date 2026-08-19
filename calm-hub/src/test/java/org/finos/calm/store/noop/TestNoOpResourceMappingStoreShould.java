package org.finos.calm.store.noop;

import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestNoOpResourceMappingStoreShould {

    private NoOpResourceMappingStore store;

    @BeforeEach
    void setup() {
        store = new NoOpResourceMappingStore();
    }

    @Test
    void throw_on_create_mapping() {
        UnsupportedOperationException ex = assertThrows(UnsupportedOperationException.class,
                () -> store.createMapping("finos", "custom-id", ResourceType.ARCHITECTURE, 1));
        assertThat(ex.getMessage(), containsString("unique-id"));
    }

    @Test
    void throw_not_found_on_get_mapping() {
        assertThrows(MappingNotFoundException.class,
                () -> store.getMapping("finos", ResourceType.ARCHITECTURE, "custom-id"));
    }

    @Test
    void return_empty_list_on_list_mappings() throws Exception {
        assertThat(store.listMappings("finos", ResourceType.PATTERN), is(empty()));
    }

    @Test
    void throw_not_found_on_get_mapping_by_numeric_id() {
        assertThrows(MappingNotFoundException.class,
                () -> store.getMappingByNumericId("finos", ResourceType.ARCHITECTURE, 1));
    }

    @Test
    void return_empty_list_on_list_mappings_by_numeric_ids() throws Exception {
        assertThat(store.listMappingsByNumericIds("finos", ResourceType.PATTERN, List.of(1, 2)), is(empty()));
    }

    @Test
    void throw_on_update_mapping_numeric_id() {
        UnsupportedOperationException ex = assertThrows(UnsupportedOperationException.class,
                () -> store.updateMappingNumericId("finos", ResourceType.PATTERN, "custom-id", 2));
        assertThat(ex.getMessage(), containsString("unique-id"));
    }

    @Test
    void throw_on_delete_mapping() {
        UnsupportedOperationException ex = assertThrows(UnsupportedOperationException.class,
                () -> store.deleteMapping("finos", ResourceType.PATTERN, "custom-id"));
        assertThat(ex.getMessage(), containsString("unique-id"));
    }
}
