package org.finos.calm.services;

import org.finos.calm.domain.SchemaValidationLimits;
import org.finos.calm.domain.conventions.ConventionDefault;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.conventions.CreateConventionRequest;
import org.finos.calm.domain.conventions.ResolvedConventionDefault;
import org.finos.calm.domain.exception.ConventionSchemaValidationException;
import org.finos.calm.domain.exception.ConventionVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ConventionStore;
import org.finos.calm.store.NamespaceStore;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TestConventionServiceShould {

    private static final ConventionType C4 = ConventionType.C4_MAPPING;
    private static final String VALID = "{\"unique-id\":\"acme\",\"node-types\":{\"aws:lambda\":\"container\","
            + "\"acme:vendor\":{\"kind\":\"software-system\",\"external\":true}},\"nesting\":\"demote\"}";

    private static ConventionSchemaValidator validator;
    private ConventionStore conventionStore;
    private NamespaceStore namespaceStore;
    private ConventionService service;

    @BeforeAll
    static void loadSchemas() {
        validator = new ConventionSchemaValidator();
    }

    @BeforeEach
    void setup() {
        conventionStore = mock(ConventionStore.class);
        namespaceStore = mock(NamespaceStore.class);
        when(conventionStore.getDefault(anyString(), any())).thenReturn(Optional.empty());
        service = new ConventionService(conventionStore, namespaceStore, validator);
    }

    @Test
    void return_the_namespace_own_default_as_not_inherited() throws Exception {
        setDefault("org.ab", 3, "1.0.0", "{\"unique-id\":\"ab\"}");

        ResolvedConventionDefault resolved = service.resolveDefault("org.ab", C4).orElseThrow();

        assertThat(resolved.namespace(), is("org.ab"));
        assertThat(resolved.inherited(), is(false));
        assertThat(resolved.convention().getString("unique-id"), is("ab"));
    }

    @Test
    void inherit_the_nearest_ancestor_default_over_a_farther_one() throws Exception {
        setDefault("org", 1, "1.0.0", "{\"unique-id\":\"org\"}");
        setDefault("org.ab", 2, "1.1.0", "{\"unique-id\":\"ab\"}");

        ResolvedConventionDefault resolved = service.resolveDefault("org.ab.cd", C4).orElseThrow();

        assertThat(resolved.namespace(), is("org.ab"));
        assertThat(resolved.conventionId(), is(2));
        assertThat(resolved.version(), is("1.1.0"));
        assertThat(resolved.inherited(), is(true));
    }

    @Test
    void inherit_the_root_default_through_three_levels() throws Exception {
        setDefault("org", 1, "1.0.0", "{\"unique-id\":\"org\"}");

        ResolvedConventionDefault resolved = service.resolveDefault("org.ab.cd", C4).orElseThrow();

        assertThat(resolved.namespace(), is("org"));
        assertThat(resolved.convention().getString("unique-id"), is("org"));
    }

    @Test
    void return_empty_when_no_namespace_in_the_chain_sets_a_default() throws Exception {
        assertThat(service.resolveDefault("org.ab.cd", C4).isPresent(), is(false));

        verify(conventionStore).getDefault("org.ab.cd", C4);
        verify(conventionStore).getDefault("org.ab", C4);
        verify(conventionStore).getDefault("org", C4);
    }

    @Test
    void skip_a_default_that_names_a_missing_version_and_use_the_parent() throws Exception {
        setDefault("org", 1, "1.0.0", "{\"unique-id\":\"org\"}");
        when(conventionStore.getDefault("org.ab", C4)).thenReturn(Optional.of(new ConventionDefault("c4-mapping", "org.ab", 2, "9.0.0")));
        when(conventionStore.readDefault("org.ab", C4, new ConventionDefault("c4-mapping", "org.ab", 2, "9.0.0")))
                .thenThrow(new ConventionVersionNotFoundException());

        assertThat(service.resolveDefault("org.ab", C4).orElseThrow().namespace(), is("org"));
    }

    @Test
    void reject_resolution_for_a_missing_namespace() throws Exception {
        doThrow(new NamespaceNotFoundException()).when(namespaceStore).requireNamespace("missing");

        assertThrows(NamespaceNotFoundException.class, () -> service.resolveDefault("missing", C4));
        verify(conventionStore, never()).getDefault(anyString(), any());
    }

    @Test
    void store_a_convention_that_matches_its_schema() throws Exception {
        CreateConventionRequest request = new CreateConventionRequest("Acme", null, VALID);
        when(conventionStore.createConventionForNamespace(request, "org", C4)).thenReturn(5);

        assertThat(service.createConvention(request, "org", C4), is(5));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            // The default and example mappings of calm-schema standards/c4 1.0
            "{\"$schema\":\"https://calm.finos.org/standards/c4/1.0/c4-mapping.json\","
                    + "\"$id\":\"https://calm.finos.org/standards/c4/1.0/calm-default.c4-mapping.json\","
                    + "\"unique-id\":\"calm-default-c4-mapping\",\"description\":\"Default\","
                    + "\"node-types\":{\"actor\":\"person\",\"ecosystem\":\"enterprise-boundary\"},\"nesting\":\"demote\"}",
            "{\"unique-id\":\"acme-c4-mapping\","
                    + "\"extends\":\"https://calm.finos.org/standards/c4/1.0/calm-default.c4-mapping.json\","
                    + "\"node-types\":{\"acme:vendor-platform\":{\"kind\":\"software-system\",\"external\":true},"
                    + "\"acme:team-folder\":\"hidden\"}}",
            "{\"unique-id\":\"x\",\"extends\":\"https://calm.finos.org/standards/c4/1.0/calm-default.c4-mapping.json\","
                    + "\"nesting\":\"strict\"}",
            "{\"unique-id\":\"a\",\"node-types\":{\"aws:rds\":{\"kind\":\"container\",\"external\":true}}}",
            "{\"unique-id\":\"a\",\"node-types\":{\"k8s:cluster\":{\"kind\":\"deployment-node\",\"external\":false}}}"
    })
    void accept_a_mapping_that_matches_the_c4_standard(String json) throws Exception {
        service.createConvention(new CreateConventionRequest("Mapping", null, json), "org", C4);

        verify(conventionStore).createConventionForNamespace(any(), anyString(), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"node-types\":{}}",
            "{\"unique-id\":\"a\",\"layout\":\"left-right\"}",
            "{\"unique-id\":\"a\",\"node-types\":{\"service\":\"microservice\"}}",
            "{\"unique-id\":\"a\",\"node-types\":{\"service\":{\"external\":true}}}",
            "{\"unique-id\":\"a\",\"node-types\":{},\"nesting\":\"flatten\"}",
            "{\"unique-id\":\"a\",\"node-types\":{\"k8s:cluster\":{\"kind\":\"deployment-node\",\"external\":true}}}",
            "{\"unique-id\":\"a\",\"node-types\":{\"ecosystem\":{\"kind\":\"enterprise-boundary\",\"external\":true}}}",
            "[1,2]",
            "not json"
    })
    void refuse_a_convention_that_does_not_match_its_schema_and_store_nothing(String json) throws Exception {
        CreateConventionRequest request = new CreateConventionRequest("Acme", null, json);

        assertThrows(ConventionSchemaValidationException.class, () -> service.createConvention(request, "org", C4));
        assertThrows(ConventionSchemaValidationException.class,
                () -> service.createConventionVersion(request, "org", C4, 1, "1.0.1"));
        verify(conventionStore, never()).createConventionForNamespace(any(), anyString(), any());
        verify(conventionStore, never()).createConventionForVersion(any(), anyString(), any(), anyInt(), anyString());
    }

    @Test
    void refuse_a_request_with_no_body() {
        assertThrows(ConventionSchemaValidationException.class, () -> service.createConvention(null, "org", C4));
    }

    @Test
    void refuse_a_convention_larger_than_the_limit_before_validating_it() {
        String big = "{\"unique-id\":\"" + "a".repeat(SchemaValidationLimits.MAX_CONVENTION_JSON_BYTES) + "\",\"node-types\":{}}";

        ConventionSchemaValidationException e = assertThrows(ConventionSchemaValidationException.class,
                () -> service.createConvention(new CreateConventionRequest("Big", null, big), "org", C4));
        assertThat(e.getErrors().get(0).error(), containsString("larger than"));
    }

    @Test
    void pass_reads_and_default_writes_to_the_store() throws Exception {
        ConventionDefault conventionDefault = new ConventionDefault("c4-mapping", "org", 1, "1.0.0");
        when(conventionStore.getConventionVersions("org", C4, 1)).thenReturn(java.util.List.of("1.0.0"));
        when(conventionStore.getConventionForVersion("org", C4, 1, "1.0.0")).thenReturn(VALID);
        when(conventionStore.setDefault("org", C4, 1, "1.0.0")).thenReturn(conventionDefault);
        when(conventionStore.deleteDefault("org", C4)).thenReturn(true);

        assertThat(service.getConventionsForNamespace("org", C4).isEmpty(), is(true));
        assertThat(service.getConventionVersions("org", C4, 1), is(java.util.List.of("1.0.0")));
        assertThat(service.getConventionForVersion("org", C4, 1, "1.0.0"), is(VALID));
        assertThat(service.setDefault("org", C4, 1, "1.0.0"), is(conventionDefault));
        assertThat(service.deleteDefault("org", C4), is(true));
        service.createConventionVersion(new CreateConventionRequest("Acme", null, VALID), "org", C4, 1, "1.0.1");
        verify(conventionStore).createConventionForVersion(new CreateConventionRequest("Acme", null, VALID), "org", C4, 1, "1.0.1");
    }

    @Test
    void return_the_parent_of_a_namespace() {
        assertThat(ConventionService.parent("org.ab.cd"), is("org.ab"));
        assertThat(ConventionService.parent("org"), is((String) null));
    }

    private void setDefault(String namespace, int id, String version, String json) throws Exception {
        ConventionDefault conventionDefault = new ConventionDefault("c4-mapping", namespace, id, version);
        when(conventionStore.getDefault(namespace, C4)).thenReturn(Optional.of(conventionDefault));
        when(conventionStore.readDefault(namespace, C4, conventionDefault)).thenReturn(json);
    }
}
