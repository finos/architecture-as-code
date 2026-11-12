package org.finos.calm.security.ldap;

import com.unboundid.ldap.sdk.Filter;
import com.unboundid.ldap.sdk.LDAPConnection;
import com.unboundid.ldap.sdk.LDAPConnectionPool;
import com.unboundid.ldap.sdk.LDAPSearchException;
import com.unboundid.ldap.sdk.ResultCode;
import com.unboundid.ldap.sdk.SearchRequest;
import org.finos.calm.config.LdapGroupsConfig.Scope;
import org.finos.calm.config.LdapGroupsConfigStub;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestLdapDirectorySessionShould {

    @Mock
    LDAPConnection mockConnection;

    @Mock
    LDAPConnectionPool mockPool;

    private LdapGroupsConfigStub config;

    @BeforeEach
    void setUp() {
        config = new LdapGroupsConfigStub();
        config.userSearch("people", "ou=people,dc=example,dc=com", 0);
        config.groupSearchBase = "ou=groups,dc=example,dc=com";
    }

    private SearchRequest request() {
        return new LdapDirectorySession(mockConnection, config, null)
                .searchRequest("dc=example,dc=com", Scope.onelevel, Filter.createPresenceFilter("cn"), 0, "cn");
    }

    @Test
    void set_the_server_time_limit_from_the_read_timeout() {
        config.readTimeout = Duration.ofSeconds(7);
        assertThat(request().getTimeLimitSeconds(), is(7));
    }

    @Test
    void round_a_short_read_timeout_up_to_one_second() {
        config.readTimeout = Duration.ofMillis(300);
        assertThat(request().getTimeLimitSeconds(), is(1));
    }

    @Test
    void treat_a_server_time_limit_as_a_failure_and_discard_the_pooled_connection() throws Exception {
        when(mockConnection.search(any(SearchRequest.class)))
                .thenThrow(new LDAPSearchException(ResultCode.TIME_LIMIT_EXCEEDED, "time limit exceeded"));
        LdapDirectorySession session = new LdapDirectorySession(mockConnection, config, mockPool);

        DirectoryException e = assertThrows(DirectoryException.class,
                () -> session.findMemberGroups("uid=alice,ou=people,dc=example,dc=com", List.of("architects")));
        assertThat(e.getMessage(), containsString("time limit exceeded"));

        session.close();
        verify(mockPool).releaseDefunctConnection(mockConnection);
    }
}
