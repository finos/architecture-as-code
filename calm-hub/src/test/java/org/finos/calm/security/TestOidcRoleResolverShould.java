package org.finos.calm.security;

import io.quarkus.security.identity.SecurityIdentity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.Principal;
import java.util.Optional;
import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestOidcRoleResolverShould {

    @Mock
    private SecurityIdentity mockIdentity;

    @Mock
    private Principal mockPrincipal;

    private OidcRoleResolver resolver;

    @BeforeEach
    void setup() {
        resolver = new OidcRoleResolver();
        resolver.globalAccessGroups = Optional.empty();
    }

    @Test
    void return_none_for_null_identity() {
        assertThat(resolver.resolve(null, Set.of("group-a")), equalTo(OidcRoleResolver.AccessLevel.NONE));
    }

    @Test
    void return_none_for_anonymous_identity() {
        when(mockIdentity.isAnonymous()).thenReturn(true);
        assertThat(resolver.resolve(mockIdentity, Set.of("group-a")), equalTo(OidcRoleResolver.AccessLevel.NONE));
    }

    @Test
    void return_none_when_no_access_groups_configured() {
        when(mockIdentity.isAnonymous()).thenReturn(false);
        resolver.globalAccessGroups = Optional.empty();

        assertThat(resolver.resolve(mockIdentity, Set.of()), equalTo(OidcRoleResolver.AccessLevel.NONE));
    }

    @Test
    void return_none_when_user_has_no_groups() {
        when(mockIdentity.isAnonymous()).thenReturn(false);
        when(mockIdentity.getRoles()).thenReturn(Set.of());
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn("alice");

        assertThat(resolver.resolve(mockIdentity, Set.of("group-a")), equalTo(OidcRoleResolver.AccessLevel.NONE));
    }

    @Test
    void return_none_when_user_has_null_groups() {
        when(mockIdentity.isAnonymous()).thenReturn(false);
        when(mockIdentity.getRoles()).thenReturn(null);
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn("alice");

        assertThat(resolver.resolve(mockIdentity, Set.of("group-a")), equalTo(OidcRoleResolver.AccessLevel.NONE));
    }

    @Test
    void return_read_when_user_group_matches() {
        when(mockIdentity.isAnonymous()).thenReturn(false);
        when(mockIdentity.getRoles()).thenReturn(Set.of("group-a", "group-b"));
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn("alice");

        assertThat(resolver.resolve(mockIdentity, Set.of("group-b")), equalTo(OidcRoleResolver.AccessLevel.READ));
    }

    @Test
    void return_none_when_user_group_does_not_match() {
        when(mockIdentity.isAnonymous()).thenReturn(false);
        when(mockIdentity.getRoles()).thenReturn(Set.of("group-x"));
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn("alice");

        assertThat(resolver.resolve(mockIdentity, Set.of("group-a")), equalTo(OidcRoleResolver.AccessLevel.NONE));
    }

    @Test
    void fall_back_to_global_config_when_access_groups_empty() {
        when(mockIdentity.isAnonymous()).thenReturn(false);
        when(mockIdentity.getRoles()).thenReturn(Set.of("global-group"));
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn("alice");
        resolver.globalAccessGroups = Optional.of("global-group;other-group");

        assertThat(resolver.resolve(mockIdentity, Set.of()), equalTo(OidcRoleResolver.AccessLevel.READ));
    }

    @Test
    void parse_blank_global_config_as_empty() {
        when(mockIdentity.isAnonymous()).thenReturn(false);
        resolver.globalAccessGroups = Optional.of("   ");

        assertThat(resolver.resolve(mockIdentity, Set.of()), equalTo(OidcRoleResolver.AccessLevel.NONE));
    }
}
