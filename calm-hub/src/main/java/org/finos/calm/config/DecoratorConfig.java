package org.finos.calm.config;

import io.smallrye.config.ConfigMapping;

import java.util.List;
import java.util.Map;

/**
 * Decorator write rules. A reserved type can only be written by its listed principals, for example
 * {@code calm.decorators.reserved."validation".writers=system}.
 */
@ConfigMapping(prefix = "calm.decorators")
public interface DecoratorConfig {

    Map<String, ReservedType> reserved();

    interface ReservedType {
        List<String> writers();
    }
}
