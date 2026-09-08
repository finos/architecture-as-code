package org.finos.calm.store.classpath;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestClasspathCoreSchemaStoreShould {

    private ClasspathCoreSchemaStore store;

    @BeforeEach
    void setup() {
        store = new ClasspathCoreSchemaStore();
    }

    @Test
    void return_empty_versions_when_no_index_file_present() {
        List<String> versions = store.getVersions();
        assertThat(versions, is(notNullValue()));
    }

    @Test
    void return_null_for_nonexistent_version() {
        Map<String, Object> schemas = store.getSchemasForVersion("99.99.99");
        assertThat(schemas, is(nullValue()));
    }

    @Test
    void throw_on_create_schema_version() {
        UnsupportedOperationException ex = assertThrows(UnsupportedOperationException.class,
                () -> store.createSchemaVersion("1.0", Map.of("core", "schema")));
        assertThat(ex.getMessage().contains("not supported"), is(true));
    }

    @Test
    void return_unmodifiable_versions_list() {
        List<String> versions = store.getVersions();
        assertThrows(UnsupportedOperationException.class, () -> versions.add("hack"));
    }

    @Test
    void return_same_versions_on_repeated_calls() {
        List<String> first = store.getVersions();
        List<String> second = store.getVersions();
        assertThat(first, equalTo(second));
    }

    @Test
    void return_null_for_empty_string_version() {
        Map<String, Object> schemas = store.getSchemasForVersion("");
        assertThat(schemas, is(nullValue()));
    }

    @Test
    void load_versions_from_classpath_resource() {
        List<String> versions = store.getVersions();
        assertThat(versions.contains("1.0"), is(true));
    }

    @Test
    void load_schemas_for_known_version() {
        Map<String, Object> schemas = store.getSchemasForVersion("1.0");
        assertThat(schemas, is(notNullValue()));
        assertThat(schemas.containsKey("core"), is(true));
    }

    @Test
    void cache_schemas_on_repeated_calls() {
        Map<String, Object> first = store.getSchemasForVersion("1.0");
        Map<String, Object> second = store.getSchemasForVersion("1.0");
        assertThat(first, is(second));
    }
}
