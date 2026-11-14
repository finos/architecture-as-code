package org.finos.calm.services;

import org.finos.calm.domain.configs.ConfigType;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestConfigSchemaValidatorShould {

    @Test
    void stop_start_up_when_a_config_type_schema_is_missing() {
        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> new ConfigSchemaValidator("no-such-directory/"));

        assertThat(e.getMessage(), containsString("no-such-directory/c4-mapping.json"));
    }

    @Test
    void stop_start_up_when_a_schema_id_differs_from_its_config_type() {
        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> new ConfigSchemaValidator("config-types-wrong-id/"));

        assertThat(e.getMessage(), containsString(ConfigType.C4_MAPPING.getSchemaId()));
    }

    @Test
    void report_the_location_of_an_error_as_a_json_pointer() {
        assertThat(new ConfigSchemaValidator().validate(ConfigType.C4_MAPPING,
                "{\"unique-id\":\"a\",\"nesting\":\"flatten\"}").get(0).location(), is("/nesting"));
        assertThat(ConfigSchemaValidator.pointer(null), is(""));
        assertThat(ConfigSchemaValidator.pointer("/nesting"), is("/nesting"));
    }
}
