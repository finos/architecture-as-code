package org.finos.calm.security;

import jakarta.enterprise.inject.Instance;
import org.finos.calm.security.ldap.LdapGroupMembershipResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.sameInstance;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGroupMembershipResolverProducerShould {

    @Mock
    Instance<NoGroupMembershipResolver> mockNoGroups;

    @Mock
    Instance<LdapGroupMembershipResolver> mockLdap;

    GroupMembershipResolverProducer producer;

    @BeforeEach
    void setUp() {
        producer = new GroupMembershipResolverProducer();
        producer.noGroupMembershipResolver = mockNoGroups;
        producer.ldapGroupMembershipResolver = mockLdap;
    }

    @Test
    void produce_the_no_group_resolver_for_provider_none() {
        NoGroupMembershipResolver noGroups = new NoGroupMembershipResolver();
        when(mockNoGroups.get()).thenReturn(noGroups);
        producer.provider = "none";

        assertThat(producer.produce(), sameInstance(noGroups));
    }

    @Test
    void produce_the_ldap_resolver_for_provider_ldap() {
        LdapGroupMembershipResolver ldap = mock(LdapGroupMembershipResolver.class);
        when(mockLdap.get()).thenReturn(ldap);
        producer.provider = "ldap";

        assertThat(producer.produce(), sameInstance(ldap));
    }

    @Test
    void reject_an_unknown_provider() {
        producer.provider = "kerberos";

        IllegalStateException e = assertThrows(IllegalStateException.class, () -> producer.produce());
        assertThat(e.getMessage(), containsString("'kerberos'"));
    }
}
