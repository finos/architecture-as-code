package org.finos.calm.config;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Fails startup on a bad {@code calm.ui.*} value, so that an operator finds the error at deploy
 * time. The colour and URL checks also stop CSS injection and {@code javascript:} links in the UI.
 */
@ApplicationScoped
public class UiConfigValidator {

    static final Set<String> COLOUR_TOKENS = Set.of("info", "success", "warning", "error", "neutral");
    private static final Pattern HEX_COLOUR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final Set<String> URL_SCHEMES = Set.of("http", "https");

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
        return errors;
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
