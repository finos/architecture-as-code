package org.finos.calm.config;

import org.finos.calm.assets.BrandingLogos;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
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
    void accept_branding_names_and_colours() {
        UiConfig config = valid();
        when(config.branding().organisationName()).thenReturn(Optional.of("N".repeat(UiConfigValidator.MAX_NAME_LENGTH)));
        when(config.branding().applicationName()).thenReturn(Optional.of("Architecture Hub"));
        when(config.branding().colour()).thenReturn(Optional.of("#0f766E"));
        when(config.branding().colourDark()).thenReturn(Optional.of("#75d6c7"));

        assertThat(UiConfigValidator.validate(config), empty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"teal", "#fff", "#12345g", "warning", "#0f766e; background: url(x)"})
    void reject_a_branding_colour_that_is_not_hex(String colour) {
        UiConfig config = valid();
        when(config.branding().colour()).thenReturn(Optional.of(colour));
        when(config.branding().colourDark()).thenReturn(Optional.of(colour));

        assertThat(UiConfigValidator.validate(config), contains(
                containsString("calm.ui.branding.colour must be a #rrggbb"),
                containsString("calm.ui.branding.colour-dark must be a #rrggbb")));
    }

    @Test
    void reject_a_blank_long_or_multi_line_name() {
        UiConfig config = valid();
        when(config.branding().organisationName()).thenReturn(Optional.of("N".repeat(UiConfigValidator.MAX_NAME_LENGTH + 1)));
        when(config.branding().applicationName()).thenReturn(Optional.of("Architecture\nHub"));
        when(config.navigation().extensionsHeading()).thenReturn(Optional.of("  "));

        assertThat(UiConfigValidator.validate(config), contains(
                containsString("calm.ui.branding.organisation-name must be at most 64 characters"),
                containsString("calm.ui.branding.application-name must not contain control characters"),
                containsString("calm.ui.navigation.extensions-heading must not be blank")));
    }

    @Test
    void accept_a_light_and_a_dark_logo(@TempDir Path dir) throws IOException {
        UiConfig config = valid();
        Path light = png(dir, "light.png");
        Path dark = Files.copy(Path.of("src/test/resources/assets/logo-24x12.png"), dir.resolve("dark.png"));
        byte[] lightBytes = Files.readAllBytes(light);
        byte[] darkBytes = Files.readAllBytes(dark);
        when(config.branding().logo().light()).thenReturn(Optional.of(light.toString()));
        when(config.branding().logo().dark()).thenReturn(Optional.of(dark.toString()));

        assertThat(UiConfigValidator.validate(config), empty());
        BrandingLogos logos = new BrandingLogos(config);
        Files.delete(light);
        Files.delete(dark);
        assertArrayEquals(lightBytes, logos.logo("light").orElseThrow().bytes());
        assertArrayEquals(darkBytes, logos.logo("dark").orElseThrow().bytes());
    }

    @Test
    void reject_a_logo_that_is_not_a_readable_image(@TempDir Path dir) throws IOException {
        Path empty = Files.write(dir.resolve("empty.png"), new byte[0]);
        UiConfig config = valid();
        when(config.branding().logo().light()).thenReturn(Optional.of(dir.resolve("missing.png").toString()));
        when(config.branding().logo().dark()).thenReturn(Optional.of(empty.toString()));

        assertThat(UiConfigValidator.validate(config), contains(
                containsString("calm.ui.branding.logo.light (" + dir.resolve("missing.png") + ") is not a readable file"),
                containsString("calm.ui.branding.logo.dark (" + empty + ")")));
        IllegalStateException error = assertThrows(IllegalStateException.class, () -> new BrandingLogos(config));
        assertThat(error.getMessage(), containsString("Invalid calm.ui configuration: logo " + dir.resolve("missing.png")));
    }

    @Test
    void reject_an_invalid_logo_path() {
        UiConfig config = valid();
        when(config.branding().logo().light()).thenReturn(Optional.of("invalid\u0000.png"));

        assertThat(UiConfigValidator.validate(config), contains(containsString("is not a readable file")));
        assertThrows(IllegalStateException.class, () -> new BrandingLogos(config));
    }

    @Test
    void reject_a_dark_logo_without_a_light_logo(@TempDir Path dir) throws IOException {
        UiConfig config = valid();
        when(config.branding().logo().dark()).thenReturn(Optional.of(png(dir, "dark.png").toString()));

        assertThat(UiConfigValidator.validate(config), contains(containsString("logo.dark needs calm.ui.branding.logo.light")));
    }

    @ParameterizedTest
    @ValueSource(strings = {"menu", "sidebar"})
    void accept_each_layout(String layout) {
        UiConfig config = valid();
        when(config.navigation().layout()).thenReturn(layout);

        assertThat(UiConfigValidator.validate(config), empty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"drawer", "Sidebar", ""})
    void reject_any_other_layout(String layout) {
        UiConfig config = valid();
        when(config.navigation().layout()).thenReturn(layout);

        assertThat(UiConfigValidator.validate(config), contains(containsString("calm.ui.navigation.layout must be one of [menu, sidebar]")));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/", "/search", "/chat", "/namespace/finos", "/namespace/org.finos-labs", "/domain/security",
            "/extensions/assurance/architecture-reviews"})
    void accept_a_start_page_on_a_hub_or_extension_screen(String path) {
        UiConfig config = valid();
        when(config.navigation().startPage()).thenReturn(Optional.of(path));

        assertThat(UiConfigValidator.validate(config), empty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"search", "/admin", "/namespace/", "/namespace/../admin", "/namespace/a..b", "/domain/a.b",
            "/extensions/assurance", "/extensions/Assurance/reviews", "/search?q=x", "//evil.example", "https://evil.example",
            "/finos/architectures/1/1.0.0"})
    void reject_any_other_start_page(String path) {
        UiConfig config = valid();
        when(config.navigation().startPage()).thenReturn(Optional.of(path));

        assertThat(UiConfigValidator.validate(config), contains(containsString("calm.ui.navigation.start-page must be")));
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
        UiConfig.Logo logo = mock(UiConfig.Logo.class);
        when(logo.light()).thenReturn(Optional.empty());
        when(logo.dark()).thenReturn(Optional.empty());
        UiConfig.Branding branding = mock(UiConfig.Branding.class);
        when(branding.organisationName()).thenReturn(Optional.empty());
        when(branding.applicationName()).thenReturn(Optional.empty());
        when(branding.colour()).thenReturn(Optional.empty());
        when(branding.colourDark()).thenReturn(Optional.empty());
        when(branding.logo()).thenReturn(logo);
        when(config.branding()).thenReturn(branding);
        UiConfig.Navigation navigation = mock(UiConfig.Navigation.class);
        when(navigation.layout()).thenReturn("menu");
        when(navigation.showNamespaces()).thenReturn(true);
        when(navigation.showControlDomains()).thenReturn(true);
        when(navigation.extensionsHeading()).thenReturn(Optional.empty());
        when(navigation.startPage()).thenReturn(Optional.empty());
        when(config.navigation()).thenReturn(navigation);
        return config;
    }

    private static UiConfig valid() {
        return config("warning");
    }

    private static UiConfig.Item item(String label, String value, String url) {
        UiConfig.Item item = mock(UiConfig.Item.class);
        when(item.label()).thenReturn(label);
        when(item.value()).thenReturn(Optional.ofNullable(value));
        when(item.url()).thenReturn(Optional.ofNullable(url));
        return item;
    }

    private static Path png(Path dir, String name) throws IOException {
        return Files.copy(Path.of("src/test/resources/branding/logo.png"), dir.resolve(name));
    }
}
