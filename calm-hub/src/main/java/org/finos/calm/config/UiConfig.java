package org.finos.calm.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

import java.util.List;
import java.util.Optional;

/**
 * Operator-supplied values that CALM Hub UI shows in its header and menu.
 * {@link UiConfigValidator} checks the values at startup.
 */
@ConfigMapping(prefix = "calm.ui")
public interface UiConfig {

    Environment environment();

    Identity identity();

    List<Item> items();

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
}
