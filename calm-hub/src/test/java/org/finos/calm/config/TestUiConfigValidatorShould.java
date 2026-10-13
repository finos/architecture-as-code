package org.finos.calm.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TestUiConfigValidatorShould {

    @ParameterizedTest
    @ValueSource(strings = {"info", "success", "warning", "error", "neutral", "#1a2B3c"})
    void accept_a_colour_token_or_hex_colour(String colour) {
        assertThat(UiConfigValidator.validate(config(colour)), empty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"red", "#fff", "#12345g", "WARNING", "red; background: url(x)", ""})
    void reject_any_other_colour(String colour) {
        List<String> errors = UiConfigValidator.validate(config(colour));

        assertThat(errors, hasSize(1));
        assertThat(errors.getFirst(), containsString("calm.ui.environment.colour"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://support.example.com/help", "http://wiki.internal:8080", "HTTPS://example.com"})
    void accept_an_http_or_https_url(String url) {
        assertThat(UiConfigValidator.validate(config("warning", item("Support", null, url))), empty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"javascript:alert(1)", "ftp://example.com", "/relative/path", "https://", "not a url"})
    void reject_any_other_url(String url) {
        List<String> errors = UiConfigValidator.validate(config("warning", item("Support", null, url)));

        assertThat(errors, contains(containsString("calm.ui.items[0].url")));
    }

    @Test
    void reject_an_item_with_neither_value_nor_url() {
        List<String> errors = UiConfigValidator.validate(config("warning", item("Build", null, null)));

        assertThat(errors, contains(containsString("calm.ui.items[0] must have a value or a url")));
    }

    @Test
    void reject_an_item_with_a_blank_label() {
        List<String> errors = UiConfigValidator.validate(config("warning", item(" ", "2026.10.1", null)));

        assertThat(errors, contains(containsString("calm.ui.items[0].label")));
    }

    @Test
    void report_every_error_with_the_item_index() {
        List<String> errors = UiConfigValidator.validate(config("pink",
                item("Build", "2026.10.1", null),
                item("Support", null, "javascript:alert(1)")));

        assertThat(errors, contains(
                containsString("calm.ui.environment.colour"),
                containsString("calm.ui.items[1].url")));
    }

    @Test
    void fail_startup_when_the_config_is_invalid() {
        UiConfigValidator validator = new UiConfigValidator();

        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> validator.onStartup(null, config("pink")));
        assertThat(e.getMessage(), containsString("Invalid calm.ui configuration"));
    }

    @Test
    void allow_startup_when_the_config_is_valid() {
        UiConfigValidator validator = new UiConfigValidator();

        assertDoesNotThrow(() -> validator.onStartup(null, config("warning", item("Build", "2026.10.1", null))));
    }

    private static UiConfig config(String colour, UiConfig.Item... items) {
        UiConfig.Environment environment = mock(UiConfig.Environment.class);
        when(environment.colour()).thenReturn(colour);
        UiConfig config = mock(UiConfig.class);
        when(config.environment()).thenReturn(environment);
        when(config.items()).thenReturn(List.of(items));
        return config;
    }

    private static UiConfig.Item item(String label, String value, String url) {
        UiConfig.Item item = mock(UiConfig.Item.class);
        when(item.label()).thenReturn(label);
        when(item.value()).thenReturn(Optional.ofNullable(value));
        when(item.url()).thenReturn(Optional.ofNullable(url));
        return item;
    }
}
