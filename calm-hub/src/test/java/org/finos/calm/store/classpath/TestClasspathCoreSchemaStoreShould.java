package org.finos.calm.store.classpath;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.anEmptyMap;
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

    @Test
    void return_empty_versions_when_the_versions_index_resource_is_entirely_absent() {
        withOverride(hiding("META-INF/calm-schemas/versions.txt"), () -> {
            ClasspathCoreSchemaStore isolatedStore = new ClasspathCoreSchemaStore();
            assertThat(isolatedStore.getVersions(), is(notNullValue()));
            assertThat(isolatedStore.getVersions().isEmpty(), is(true));
        });
    }

    @Test
    void return_empty_schemas_when_a_known_versions_files_index_is_missing() {
        withOverride(hiding("META-INF/calm-schemas/1.0/files.txt"), () -> {
            ClasspathCoreSchemaStore isolatedStore = new ClasspathCoreSchemaStore();
            assertThat(isolatedStore.getSchemasForVersion("1.0"), is(anEmptyMap()));
        });
    }

    @Test
    void skip_blank_lines_in_the_files_index() {
        withOverride(Map.of("META-INF/calm-schemas/1.0/files.txt",
                "\ncore.json\n".getBytes(StandardCharsets.UTF_8)), () -> {
            ClasspathCoreSchemaStore isolatedStore = new ClasspathCoreSchemaStore();
            assertThat(isolatedStore.getSchemasForVersion("1.0").containsKey("core"), is(true));
        });
    }

    @Test
    void skip_a_file_listed_in_the_index_whose_own_resource_is_missing() {
        withOverride(hiding("META-INF/calm-schemas/1.0/meta/core.json"), () -> {
            ClasspathCoreSchemaStore isolatedStore = new ClasspathCoreSchemaStore();
            assertThat(isolatedStore.getSchemasForVersion("1.0").containsKey("core"), is(false));
        });
    }

    private static Map<String, byte[]> hiding(String resourceName) {
        Map<String, byte[]> overrides = new HashMap<>();
        overrides.put(resourceName, null);
        return overrides;
    }

    /**
     * Runs {@code action} with the current thread's context classloader replaced by
     * one that serves the given resource-name overrides (a {@code null} value hides
     * the resource entirely; otherwise its bytes are served) and delegates everything
     * else to the real classloader - restores the original afterwards regardless of
     * outcome.
     */
    private static void withOverride(Map<String, byte[]> overrides, Runnable action) {
        ClassLoader original = Thread.currentThread().getContextClassLoader();
        Thread.currentThread().setContextClassLoader(new ResourceOverridingClassLoader(original, overrides));
        try {
            action.run();
        } finally {
            Thread.currentThread().setContextClassLoader(original);
        }
    }

    private static class ResourceOverridingClassLoader extends ClassLoader {
        private final Map<String, byte[]> overrides;

        ResourceOverridingClassLoader(ClassLoader parent, Map<String, byte[]> overrides) {
            super(parent);
            this.overrides = new HashMap<>(overrides);
        }

        @Override
        public InputStream getResourceAsStream(String name) {
            if (overrides.containsKey(name)) {
                byte[] bytes = overrides.get(name);
                return bytes == null ? null : new ByteArrayInputStream(bytes);
            }
            return super.getResourceAsStream(name);
        }
    }
}
