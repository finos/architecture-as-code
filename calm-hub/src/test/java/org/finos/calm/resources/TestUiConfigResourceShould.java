package org.finos.calm.resources;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.ws.rs.core.Response;
import org.finos.calm.config.UiConfig;
import org.finos.calm.domain.ui.UiConfigResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.security.Principal;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class TestUiConfigResourceShould {

    private UiConfig config;
    private UiConfig.Environment environment;
    private UiConfig.Identity identityConfig;
    private SecurityIdentity identity;
    private UiConfigResource resource;

    @BeforeEach
    void setup() {
        config = mock(UiConfig.class);
        environment = mock(UiConfig.Environment.class);
        identityConfig = mock(UiConfig.Identity.class);
        identity = mock(SecurityIdentity.class);
        when(config.environment()).thenReturn(environment);
        when(config.identity()).thenReturn(identityConfig);
        when(config.items()).thenReturn(List.of());
        when(environment.name()).thenReturn(Optional.empty());
        when(environment.colour()).thenReturn("warning");
        resource = new UiConfigResource(config, identity);
    }

    @Test
    void leave_out_every_section_when_nothing_is_configured() {
        UiConfigResponse body = getBody();

        assertThat(body, equalTo(new UiConfigResponse(null, null, null)));
        verifyNoInteractions(identity);
    }

    @Test
    void return_the_environment_when_a_name_is_configured() {
        when(environment.name()).thenReturn(Optional.of("UAT"));
        when(environment.colour()).thenReturn("#ff8800");

        assertThat(getBody().environment(), equalTo(new UiConfigResponse.Environment("UAT", "#ff8800")));
    }

    @Test
    void leave_out_the_environment_when_the_name_is_blank() {
        when(environment.name()).thenReturn(Optional.of("  "));

        assertThat(getBody().environment(), nullValue());
    }

    @Test
    void return_the_principal_name_without_roles_when_identity_is_enabled() {
        when(identityConfig.enabled()).thenReturn(true);
        givenIdentity("alice", Set.of("admins"));

        assertThat(getBody().identity(), equalTo(new UiConfigResponse.Identity("alice", null)));
    }

    @Test
    void return_sorted_roles_when_identity_and_roles_are_enabled() {
        when(identityConfig.enabled()).thenReturn(true);
        when(identityConfig.showRoles()).thenReturn(true);
        givenIdentity("alice", Set.of("writers", "admins"));

        assertThat(getBody().identity(), equalTo(new UiConfigResponse.Identity("alice", List.of("admins", "writers"))));
    }

    @Test
    void leave_out_the_identity_when_only_roles_are_enabled() {
        when(identityConfig.showRoles()).thenReturn(true);

        assertThat(getBody().identity(), nullValue());
        verifyNoInteractions(identity);
    }

    @Test
    void return_items_in_the_configured_order() {
        UiConfig.Item build = item("Build", "2026.10.1", null);
        UiConfig.Item support = item("Support", null, "https://support.example.com");
        when(config.items()).thenReturn(List.of(build, support));

        assertThat(getBody().items(), contains(
                new UiConfigResponse.Item("Build", "2026.10.1", null),
                new UiConfigResponse.Item("Support", null, "https://support.example.com")));
    }

    private UiConfigResponse getBody() {
        Response response = resource.getUiConfig();
        assertThat(response.getStatus(), equalTo(200));
        return (UiConfigResponse) response.getEntity();
    }

    private void givenIdentity(String name, Set<String> roles) {
        Principal principal = () -> name;
        when(identity.getPrincipal()).thenReturn(principal);
        when(identity.getRoles()).thenReturn(roles);
    }

    private static UiConfig.Item item(String label, String value, String url) {
        UiConfig.Item item = mock(UiConfig.Item.class);
        when(item.label()).thenReturn(label);
        when(item.value()).thenReturn(Optional.ofNullable(value));
        when(item.url()).thenReturn(Optional.ofNullable(url));
        return item;
    }
}
