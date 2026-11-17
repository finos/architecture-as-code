package org.finos.calm.config;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import org.finos.calm.assets.BrandingLogos;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Fails startup on a bad {@code calm.ui.*} value, so that an operator finds the error at deploy
 * time. The colour and URL checks also stop CSS injection and {@code javascript:} links in the UI.
 */
@ApplicationScoped
public class UiConfigValidator {

    static final Set<String> COLOUR_TOKENS = Set.of("info", "success", "warning", "error", "neutral");
    static final Set<String> LAYOUTS = Set.of("menu", "sidebar");
    static final int MAX_NAME_LENGTH = 64;
    static final int MAX_HEADING_LENGTH = 40;
    private static final Pattern HEX_COLOUR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final Set<String> URL_SCHEMES = Set.of("http", "https");
    private static final String NAME = "[A-Za-z0-9-]+";
    private static final String EXTENSION_ID = "[a-z][a-z0-9-]*";
    /** The Hub routes that can open first. Each segment uses the characters of its id, so a path cannot leave the route. */
    private static final Pattern START_PAGE = Pattern.compile("^/(|search|chat"
            + "|namespace/" + NAME + "(\\." + NAME + ")*"
            + "|domain/" + NAME
            + "|extensions/" + EXTENSION_ID + "/" + EXTENSION_ID + ")$");

    void onStartup(@Observes StartupEvent event, UiConfig config) {
        List<String> errors = validate(config);
        if (!errors.isEmpty()) {
            throw new IllegalStateException("Invalid calm.ui configuration: " + String.join("; ", errors));
        }
    }

    static List<String> validate(UiConfig config) {
        List<String> errors = new ArrayList<>();

        String colour = config.environment().colour();
        if (!COLOUR_TOKENS.contains(colour) && !HEX_COLOUR.matcher(colour).matches()) {
            errors.add("calm.ui.environment.colour must be one of " + COLOUR_TOKENS.stream().sorted().toList()
                    + " or a #rrggbb hex colour, but was '" + colour + "'");
        }

        List<UiConfig.Item> items = config.items();
        for (int i = 0; i < items.size(); i++) {
            UiConfig.Item item = items.get(i);
            String prefix = "calm.ui.items[" + i + "]";
            if (item.label().isBlank()) {
                errors.add(prefix + ".label must not be blank");
            }
            if (item.value().isEmpty() && item.url().isEmpty()) {
                errors.add(prefix + " must have a value or a url");
            }
            item.url().filter(url -> !isHttpUrl(url))
                    .ifPresent(url -> errors.add(prefix + ".url must be an absolute http or https URL, but was '" + url + "'"));
        }

        validateBranding(config.branding(), errors);
        validateNavigation(config.navigation(), errors);
        return errors;
    }

    private static void validateBranding(UiConfig.Branding branding, List<String> errors) {
        checkText("calm.ui.branding.organisation-name", branding.organisationName(), MAX_NAME_LENGTH, errors);
        checkText("calm.ui.branding.application-name", branding.applicationName(), MAX_NAME_LENGTH, errors);
        checkHexColour("calm.ui.branding.colour", branding.colour(), errors);
        checkHexColour("calm.ui.branding.colour-dark", branding.colourDark(), errors);
        checkImage("calm.ui.branding.logo.light", branding.logo().light(), errors);
        checkImage("calm.ui.branding.logo.dark", branding.logo().dark(), errors);
        if (branding.logo().dark().isPresent() && branding.logo().light().isEmpty()) {
            errors.add("calm.ui.branding.logo.dark needs calm.ui.branding.logo.light");
        }
    }

    private static void validateNavigation(UiConfig.Navigation navigation, List<String> errors) {
        if (!LAYOUTS.contains(navigation.layout())) {
            errors.add("calm.ui.navigation.layout must be one of " + LAYOUTS.stream().sorted().toList()
                    + ", but was '" + navigation.layout() + "'");
        }
        checkText("calm.ui.navigation.extensions-heading", navigation.extensionsHeading(), MAX_HEADING_LENGTH, errors);
        navigation.startPage().filter(path -> !START_PAGE.matcher(path).matches())
                .ifPresent(path -> errors.add("calm.ui.navigation.start-page must be /, /search, /chat, /namespace/<namespace>, "
                        + "/domain/<domain> or /extensions/<extension-id>/<screen-id>, but was '" + path + "'"));
    }

    private static void checkText(String key, Optional<String> text, int maxLength, List<String> errors) {
        text.ifPresent(value -> {
            if (value.isBlank()) {
                errors.add(key + " must not be blank");
            } else if (value.length() > maxLength) {
                errors.add(key + " must be at most " + maxLength + " characters");
            } else if (value.chars().anyMatch(Character::isISOControl)) {
                errors.add(key + " must not contain control characters");
            }
        });
    }

    private static void checkHexColour(String key, Optional<String> colour, List<String> errors) {
        colour.filter(value -> !HEX_COLOUR.matcher(value).matches())
                .ifPresent(value -> errors.add(key + " must be a #rrggbb hex colour, but was '" + value + "'"));
    }

    private static void checkImage(String key, Optional<String> path, List<String> errors) {
        path.ifPresent(value -> {
            try {
                BrandingLogos.read(value);
            } catch (IllegalArgumentException e) {
                errors.add(key + " (" + value + ") " + e.getMessage());
            }
        });
    }

    private static boolean isHttpUrl(String url) {
        try {
            URI uri = new URI(url);
            return uri.getScheme() != null
                    && URL_SCHEMES.contains(uri.getScheme().toLowerCase())
                    && uri.getHost() != null;
        } catch (URISyntaxException e) {
            return false;
        }
    }
}
