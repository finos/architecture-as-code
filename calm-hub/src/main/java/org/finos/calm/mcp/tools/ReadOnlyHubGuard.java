package org.finos.calm.mcp.tools;

import jakarta.interceptor.InterceptorBinding;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Put on each MCP tool class. On a read-only Hub, {@link ReadOnlyHubGuardInterceptor} refuses its tools that change
 * data: MCP is served outside JAX-RS, so {@link org.finos.calm.security.ReadOnlyRequestFilter} never sees it.
 */
@InterceptorBinding
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface ReadOnlyHubGuard {
}
