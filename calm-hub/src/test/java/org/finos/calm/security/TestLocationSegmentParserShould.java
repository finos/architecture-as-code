package org.finos.calm.security;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;

import org.finos.calm.domain.audit.AuditEntityType;
import org.junit.jupiter.api.Test;

class TestLocationSegmentParserShould {

    @Test
    void return_nulls_when_location_path_is_null() {
        LocationSegmentParser.LocationIds ids =
                LocationSegmentParser.parse(AuditEntityType.NAMESPACE, null);

        assertThat(ids.entityId(), is(nullValue()));
        assertThat(ids.version(), is(nullValue()));
    }

    @Test
    void return_nulls_when_location_path_is_blank() {
        LocationSegmentParser.LocationIds ids =
                LocationSegmentParser.parse(AuditEntityType.NAMESPACE, "   ");

        assertThat(ids.entityId(), is(nullValue()));
        assertThat(ids.version(), is(nullValue()));
    }

    @Test
    void return_nulls_rather_than_an_empty_entity_id_when_location_path_is_only_slashes() {
        LocationSegmentParser.LocationIds ids =
                LocationSegmentParser.parse(AuditEntityType.NAMESPACE, "/");

        assertThat(ids.entityId(), is(nullValue()));
        assertThat(ids.version(), is(nullValue()));
    }

    @Test
    void parse_namespace_and_domain_as_last_segment() {
        assertThat(
                LocationSegmentParser.parse(AuditEntityType.NAMESPACE, "/api/calm/namespaces/finos")
                        .entityId(),
                is("finos"));
        assertThat(
                LocationSegmentParser.parse(AuditEntityType.DOMAIN, "/api/calm/domains/payments")
                        .entityId(),
                is("payments"));
    }

    @Test
    void parse_schema_version_as_segment_before_meta() {
        LocationSegmentParser.LocationIds ids =
                LocationSegmentParser.parse(AuditEntityType.SCHEMA, "/calm/schemas/1.0/meta");

        assertThat(ids.entityId(), is("1.0"));
    }

    @Test
    void parse_versioned_entity_types_around_the_versions_anchor() {
        LocationSegmentParser.LocationIds ids =
                LocationSegmentParser.parse(
                        AuditEntityType.PATTERN,
                        "/api/calm/namespaces/finos/patterns/7/versions/1.0.0");

        assertThat(ids.entityId(), is("7"));
        assertThat(ids.version(), is("1.0.0"));
    }

    @Test
    void parse_document_id_and_version_around_the_versions_anchor() {
        LocationSegmentParser.LocationIds ids =
                LocationSegmentParser.parse(
                        AuditEntityType.DOCUMENT,
                        "/api/calm/namespaces/finos/documents/pattern/5/versions/1.0.0");

        assertThat(ids.entityId(), is("5"));
        assertThat(ids.version(), is("1.0.0"));
    }

    @Test
    void parse_adr_around_the_revisions_anchor() {
        LocationSegmentParser.LocationIds ids =
                LocationSegmentParser.parse(
                        AuditEntityType.ADR, "/api/calm/namespaces/finos/adrs/9/revisions/1");

        assertThat(ids.entityId(), is("9"));
        assertThat(ids.version(), is("1"));
    }

    @Test
    void parse_control_requirement_and_configuration_as_last_segment() {
        assertThat(
                LocationSegmentParser.parse(
                                AuditEntityType.CONTROL_REQUIREMENT,
                                "/api/calm/domains/payments/controls/11")
                        .entityId(),
                is("11"));
        assertThat(
                LocationSegmentParser.parse(
                                AuditEntityType.CONTROL_CONFIGURATION,
                                "/api/calm/domains/payments/controls/11/configurations/3")
                        .entityId(),
                is("3"));
    }

    @Test
    void parse_user_access_and_decorator_as_last_segment() {
        assertThat(
                LocationSegmentParser.parse(
                                AuditEntityType.USER_ACCESS,
                                "/api/calm/namespaces/finos/user-access/3")
                        .entityId(),
                is("3"));
        assertThat(
                LocationSegmentParser.parse(
                                AuditEntityType.DECORATOR,
                                "/api/calm/namespaces/finos/decorators/4")
                        .entityId(),
                is("4"));
    }
}
