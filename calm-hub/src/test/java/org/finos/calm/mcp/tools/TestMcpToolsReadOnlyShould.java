package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.ToolResponse;
import io.quarkus.arc.Arc;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.inject.Any;
import jakarta.enterprise.inject.spi.Bean;
import jakarta.inject.Inject;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.finos.calm.mcp.tools.McpTestClient.callTool;
import static org.finos.calm.mcp.tools.McpTestClient.text;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** MCP is not served through JAX-RS, so the read-only filter does not see it: each write tool must refuse itself. */
@QuarkusTest
@TestProfile(TestMcpToolsReadOnlyShould.ReadOnlyProfile.class)
class TestMcpToolsReadOnlyShould {

    private static final JsonObject DECORATOR_ARGUMENTS = new JsonObject().put("namespace", "finos")
            .put("decoratorJson", "{\"unique-id\":\"d\",\"type\":\"deployment\",\"target\":[\"/a\"],\"applies-to\":[\"n\"],\"data\":{\"k\":1}}");

    public static class ReadOnlyProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("calm.readonly", "true", "calm.mcp.enabled", "true", "allow.put.operations", "true");
        }
    }

    @Inject
    DecoratorTools decoratorTools;

    @InjectMock
    UserAccessStore mockUserAccessStore;

    @InjectMock
    DecoratorStore mockDecoratorStore;

    // Each MCP tool bean, so a new tool class that changes data and lacks @ReadOnlyHubGuard fails here.
    @Test
    @TestSecurity(authorizationEnabled = false)
    void refuse_every_tool_that_changes_data() throws Exception {
        List<String> refused = new ArrayList<>();
        for (Bean<?> bean : Arc.container().beanManager().getBeans(Object.class, Any.Literal.INSTANCE)) {
            Class<?> type = bean.getBeanClass();
            for (Method method : type.getDeclaredMethods()) {
                if (!ReadOnlyHubGuardInterceptor.changesData(method)) {
                    continue;
                }
                ToolResponse response = (ToolResponse) method.invoke(Arc.container().instance(type).get(), defaultArguments(method));
                assertThat(type.getSimpleName() + "." + method.getName(),
                        response.firstContent().asText().text(), is(ReadOnlyHubGuardInterceptor.READ_ONLY_MESSAGE));
                refused.add(method.getName());
            }
        }

        assertThat(refused, hasItems("createDecorator", "updateDecorator", "createArchitecture", "updateArchitecture",
                "createNamespace", "createDomain", "createControlRequirement", "createTimeline", "updateAdrStatus"));
    }

    @Test
    @TestSecurity(authorizationEnabled = false)
    void run_a_tool_that_only_reads() {
        ToolResponse response = decoratorTools.listDecorators("not a namespace", null, null);

        assertThat(response.firstContent().asText().text(), not(is(ReadOnlyHubGuardInterceptor.READ_ONLY_MESSAGE)));
        assertThat(response.firstContent().asText().text(), containsString("amespace"));
    }

    // Through the MCP server's own invoker, not the bean, to show that the invoker goes through the interceptor.
    @Test
    @TestSecurity(user = "alice")
    void refuse_a_write_tool_called_over_mcp() {
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(new UserAccess("alice", UserAccess.Permission.write, "finos")));

        JsonObject result = callTool("createDecorator", DECORATOR_ARGUMENTS);

        assertThat(result.encode(), result.getBoolean("isError"), is(true));
        assertThat(text(result), is(ReadOnlyHubGuardInterceptor.READ_ONLY_MESSAGE));
        verifyNoInteractions(mockDecoratorStore);
    }

    // The read-only check runs before the permission check, as the docs say.
    @Test
    @TestSecurity(user = "bob")
    void refuse_a_write_tool_called_over_mcp_before_the_permission_check() {
        when(mockUserAccessStore.getGrantsForUser("bob")).thenReturn(List.of());

        JsonObject result = callTool("createDecorator", DECORATOR_ARGUMENTS);

        assertThat(text(result), is(ReadOnlyHubGuardInterceptor.READ_ONLY_MESSAGE));
        verifyNoInteractions(mockDecoratorStore);
    }

    private static Object[] defaultArguments(Method method) {
        Class<?>[] types = method.getParameterTypes();
        Object[] arguments = new Object[types.length];
        for (int i = 0; i < types.length; i++) {
            if (types[i] == int.class) {
                arguments[i] = 0;
            } else if (types[i] == long.class) {
                arguments[i] = 0L;
            } else if (types[i] == boolean.class) {
                arguments[i] = false;
            }
        }
        return arguments;
    }
}
