package org.finos.calm.services;

import org.finos.calm.domain.conventions.ConventionType;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestConventionSchemaValidatorShould {

    @Test
    void stop_start_up_when_a_convention_type_schema_is_missing() {
        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> new ConventionSchemaValidator("no-such-directory/"));

        assertThat(e.getMessage(), containsString("no-such-directory/c4-mapping.json"));
    }

    @Test
    void stop_start_up_when_a_schema_id_differs_from_its_convention_type() {
        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> new ConventionSchemaValidator("convention-types-wrong-id/"));

        assertThat(e.getMessage(), containsString(ConventionType.C4_MAPPING.getSchemaId()));
    }

    @Test
    void report_the_location_of_an_error_as_a_json_pointer() {
        assertThat(new ConventionSchemaValidator().validate(ConventionType.C4_MAPPING,
                "{\"unique-id\":\"a\",\"nesting\":\"flatten\"}").get(0).location(), is("/nesting"));
        assertThat(ConventionSchemaValidator.pointer(null), is(""));
        assertThat(ConventionSchemaValidator.pointer("/nesting"), is("/nesting"));
    }
}
