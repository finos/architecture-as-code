package org.finos.calm.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

import java.util.List;
import java.util.Optional;

/**
 * Operator-supplied values that CALM Hub UI shows in its header and menu, its branding and its navigation.
 * {@link UiConfigValidator} checks the values at startup.
 */
@ConfigMapping(prefix = "calm.ui")
public interface UiConfig {

    Environment environment();

    Identity identity();

    List<Item> items();

    Branding branding();

    Navigation navigation();

    interface Environment {
        Optional<String> name();

        /** A DaisyUI semantic colour token or a {@code #rrggbb} hex colour. */
        @WithDefault("warning")
        String colour();
    }

    interface Identity {
        @WithDefault("false")
        boolean enabled();

        /** Has no effect unless {@link #enabled()} is true. */
        @WithDefault("false")
        boolean showRoles();
    }

    interface Item {
        String label();

        Optional<String> value();

        Optional<String> url();
    }

    interface Branding {
        Optional<String> organisationName();

        Optional<String> applicationName();

        /** A {@code #rrggbb} hex colour. The UI changes it where needed so that text in it stays readable. */
        Optional<String> colour();

        /** The colour for the dark theme. Without it, the UI lightens {@link #colour()}. */
        Optional<String> colourDark();

        Logo logo();
    }

    interface Logo {
        /** The path of a PNG, JPEG, WebP or SVG file, read at startup. */
        Optional<String> light();

        /** The logo for the dark theme. Needs {@link #light()}. */
        Optional<String> dark();
    }

    interface Navigation {
        /** {@code menu}: the menu opens as a drawer. {@code sidebar}: wide screens show it at all times. */
        @WithDefault("menu")
        String layout();

        @WithDefault("true")
        boolean showNamespaces();

        @WithDefault("true")
        boolean showControlDomains();

        /** Replaces the default heading of the extensions in the menu and on the home page. */
        Optional<String> extensionsHeading();

        /** The Hub path that opens when a user opens Hub without a path. */
        Optional<String> startPage();
    }
}
