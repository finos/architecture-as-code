package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolResponse;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import jakarta.annotation.Priority;
import jakarta.interceptor.AroundInvoke;
import jakarta.interceptor.Interceptor;
import jakarta.interceptor.InvocationContext;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.security.CalmHubScopes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Set;

/**
 * Refuses the MCP tools that change data when {@code calm.readonly=true}, as the REST read-only filter refuses
 * a mutating method. A tool is a read when it needs only read scopes, or only authentication. Any other tool,
 * also one with no permission annotation, is refused. {@link ReadOnlyHubToolFilter} hides the same tools from
 * {@code tools/list}.
 */
@ReadOnlyHubGuard
@Interceptor
@Priority(Interceptor.Priority.PLATFORM_BEFORE)
public class ReadOnlyHubGuardInterceptor {

    static final String READ_ONLY_MESSAGE = "Error: This CALM Hub is read-only, so its MCP tools that change data are disabled.";
    private static final Set<String> READ_SCOPES = Set.of(CalmHubScopes.READ, CalmHubScopes.DOMAIN_READ);
    private static final Logger LOG = LoggerFactory.getLogger(ReadOnlyHubGuardInterceptor.class);

    // Read at call time, not injected, for the reason that ReadOnlyRequestFilter gives.
    @AroundInvoke
    Object refuseWritesOnReadOnlyHub(InvocationContext context) throws Exception {
        return refuseWrites(context, readOnlyHub());
    }

    static boolean readOnlyHub() {
        return ConfigProvider.getConfig().getOptionalValue("calm.readonly", Boolean.class).orElse(false);
    }

    static Object refuseWrites(InvocationContext context, boolean readOnly) throws Exception {
        if (readOnly && changesData(context.getMethod())) {
            LOG.warn("Read-only mode: refused MCP tool {}", context.getMethod().getName());
            return ToolResponse.error(READ_ONLY_MESSAGE);
        }
        return context.proceed();
    }

    static boolean changesData(Method method) {
        if (!method.isAnnotationPresent(Tool.class)) {
            return false;
        }
        PermissionsAllowed permissions = method.getAnnotation(PermissionsAllowed.class);
        if (permissions == null) {
            return !method.isAnnotationPresent(Authenticated.class);
        }
        return !READ_SCOPES.containsAll(Arrays.asList(permissions.value()));
    }
}
