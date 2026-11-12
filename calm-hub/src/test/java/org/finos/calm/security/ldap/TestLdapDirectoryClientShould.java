package org.finos.calm.security.ldap;

import com.unboundid.ldap.listener.InMemoryDirectoryServer;
import com.unboundid.ldap.listener.InMemoryDirectoryServerConfig;
import com.unboundid.ldap.listener.InMemoryListenerConfig;
import com.unboundid.util.ssl.KeyStoreKeyManager;
import com.unboundid.util.ssl.SSLUtil;
import com.unboundid.util.ssl.TrustAllTrustManager;
import org.finos.calm.config.LdapGroupsConfig.AuthMode;
import org.finos.calm.config.LdapGroupsConfig.Scope;
import org.finos.calm.config.LdapGroupsConfig.UserSearchPolicy;
import org.finos.calm.config.LdapGroupsConfigStub;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import com.unboundid.ldap.sdk.GSSAPIBindRequest;
import com.unboundid.ldap.sdk.LDAPURL;
import com.unboundid.ldap.sdk.SimpleBindRequest;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.time.Duration;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.instanceOf;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestLdapDirectoryClientShould {

    private static final String BASE = "dc=example,dc=com";
    private static final String BIND_DN = "cn=calm-hub," + BASE;
    private static final String BIND_PASSWORD = "secret";
    private static final String STORE_PASSWORD = "changeit";
    private static final String ALICE = "uid=alice,ou=people," + BASE;
    private static final String BOB = "uid=bob,ou=people," + BASE;

    @TempDir
    static Path tempDir;

    private static InMemoryDirectoryServer server;
    private static Path keystore;
    private static Path otherKeystore;

    private LdapGroupsConfigStub config;

    @BeforeAll
    static void startServer() throws Exception {
        keystore = certificate("server.p12", "localhost");
        otherKeystore = certificate("other.p12", "ldap.example.com");
        SSLUtil serverSsl = serverSsl(keystore);
        SSLUtil otherSsl = serverSsl(otherKeystore);
        InMemoryDirectoryServerConfig serverConfig = new InMemoryDirectoryServerConfig(BASE);
        serverConfig.addAdditionalBindCredentials(BIND_DN, BIND_PASSWORD);
        serverConfig.setListenerConfigs(
                InMemoryListenerConfig.createLDAPConfig("ldap", null, 0, serverSsl.createSSLSocketFactory()),
                InMemoryListenerConfig.createLDAPSConfig("ldaps", null, 0, serverSsl.createSSLServerSocketFactory(), null),
                InMemoryListenerConfig.createLDAPConfig("ldap-other", null, 0, otherSsl.createSSLSocketFactory()),
                InMemoryListenerConfig.createLDAPSConfig("ldaps-other", null, 0, otherSsl.createSSLServerSocketFactory(), null));
        server = new InMemoryDirectoryServer(serverConfig);
        server.add("dn: " + BASE, "objectClass: domain", "dc: example");
        for (String ou : List.of("people", "staff", "groups")) {
            server.add("dn: ou=" + ou + "," + BASE, "objectClass: organizationalUnit", "ou: " + ou);
        }
        server.add("dn: ou=sub,ou=groups," + BASE, "objectClass: organizationalUnit", "ou: sub");
        person("alice", "people");
        person("bob", "people");
        person("dup", "people");
        person("dup", "staff");
        group("architects", "ou=groups", ALICE, BOB);
        group("reviewers", "ou=groups", BOB);
        group("Ops", "ou=groups", ALICE);
        group("g)(x*", "ou=groups", ALICE);
        group("nested", "ou=sub,ou=groups", ALICE);
        server.add("dn: cn=unique-architects,ou=groups," + BASE, "objectClass: groupOfUniqueNames",
                "cn: unique-architects", "uniqueMember: " + ALICE);
        server.startListening();
    }

    private static Path certificate(String file, String host) throws Exception {
        Path path = tempDir.resolve(file);
        Process keytool = new ProcessBuilder(Path.of(System.getProperty("java.home"), "bin", "keytool").toString(),
                "-genkeypair", "-alias", "server", "-keyalg", "RSA", "-keysize", "2048", "-validity", "2",
                "-dname", "CN=" + host, "-ext", "SAN=dns:" + host,
                "-storetype", "PKCS12", "-keystore", path.toString(),
                "-storepass", STORE_PASSWORD, "-keypass", STORE_PASSWORD)
                .redirectErrorStream(true).start();
        if (keytool.waitFor() != 0) {
            throw new IllegalStateException(new String(keytool.getInputStream().readAllBytes()));
        }
        return path;
    }

    private static SSLUtil serverSsl(Path keystore) throws Exception {
        return new SSLUtil(
                new KeyStoreKeyManager(keystore.toFile(), STORE_PASSWORD.toCharArray(), "PKCS12", "server"),
                new TrustAllTrustManager());
    }

    private static void person(String uid, String ou) throws Exception {
        server.add("dn: uid=" + uid + ",ou=" + ou + "," + BASE, "objectClass: inetOrgPerson",
                "uid: " + uid, "cn: " + uid, "sn: " + uid);
    }

    private static void group(String cn, String parent, String... members) throws Exception {
        String dn = "cn=" + cn.replace(")", "\\29").replace("(", "\\28").replace("*", "\\2a") + "," + parent + "," + BASE;
        String[] lines = new String[members.length + 3];
        lines[0] = "dn: " + dn;
        lines[1] = "objectClass: groupOfNames";
        lines[2] = "cn: " + cn;
        for (int i = 0; i < members.length; i++) {
            lines[i + 3] = "member: " + members[i];
        }
        server.add(lines);
    }

    @AfterAll
    static void stopServer() {
        server.shutDown(true);
    }

    @BeforeEach
    void setUp() {
        config = new LdapGroupsConfigStub();
        config.url = "ldap://localhost:" + server.getListenPort("ldap");
        config.authMode = AuthMode.simple;
        config.bindDn = BIND_DN;
        config.bindPassword = BIND_PASSWORD;
        config.userSearch("people", "ou=people," + BASE, 0);
        config.groupSearchBase = "ou=groups," + BASE;
    }

    private Optional<String> findUserDn(String username) throws DirectoryException {
        try (DirectorySession session = new LdapDirectoryClient(config).open()) {
            return session.findUserDn(username);
        }
    }

    private java.util.Set<String> findMemberGroups(String userDn, List<String> groups) throws DirectoryException {
        try (DirectorySession session = new LdapDirectoryClient(config).open()) {
            return session.findMemberGroups(userDn, groups);
        }
    }

    // --- User searches ---

    @Test
    void find_the_dn_of_a_user() throws Exception {
        assertThat(findUserDn("alice"), is(Optional.of(ALICE)));
    }

    @Test
    void return_empty_for_an_unknown_user() throws Exception {
        assertThat(findUserDn("ghost"), is(Optional.empty()));
    }

    @Test
    void escape_the_username_in_the_filter() throws Exception {
        assertThat(findUserDn("*"), is(Optional.empty()));
        assertThat(findUserDn("alice)(uid=*"), is(Optional.empty()));
    }

    @Test
    void reject_a_user_found_in_two_searches_under_the_unique_policy() {
        config.userSearch("staff", "ou=staff," + BASE, 1);

        DirectoryException e = assertThrows(DirectoryException.class, () -> findUserDn("dup"));
        assertThat(e.getMessage(), containsString("More than one directory entry matches user [dup]"));
    }

    @Test
    void reject_two_matches_in_one_search_under_the_unique_policy() {
        config.userSearch("people").filter = "(|(uid={0})(uid=bob))";

        assertThrows(DirectoryException.class, () -> findUserDn("alice"));
    }

    @Test
    void count_the_same_entry_from_two_searches_once_under_the_unique_policy() throws Exception {
        config.userSearch("everyone", BASE, 1);
        config.userSearch("everyone").scope = Scope.subtree;

        assertThat(findUserDn("alice"), is(Optional.of(ALICE)));
    }

    @Test
    void take_the_first_match_in_search_order_under_the_first_policy() throws Exception {
        config.userSearchPolicy = UserSearchPolicy.first;
        config.userSearch("staff", "ou=staff," + BASE, -1);

        assertThat(findUserDn("dup"), is(Optional.of("uid=dup,ou=staff," + BASE)));
    }

    @Test
    void take_one_of_several_matches_in_one_search_under_the_first_policy() throws Exception {
        config.userSearchPolicy = UserSearchPolicy.first;
        config.userSearch("people").filter = "(|(uid={0})(uid=bob))";

        assertThat(findUserDn("alice").isPresent(), is(true));
    }

    @Test
    void fail_for_a_search_base_that_does_not_exist() {
        config.userSearch("people").base = "ou=missing," + BASE;

        assertThrows(DirectoryException.class, () -> findUserDn("alice"));
    }

    // --- Group searches ---

    @Test
    void find_the_member_groups_among_the_candidates() throws Exception {
        assertThat(findMemberGroups(ALICE, List.of("architects", "reviewers", "operators")),
                containsInAnyOrder("architects"));
        assertThat(findMemberGroups(BOB, List.of("architects", "reviewers")),
                containsInAnyOrder("architects", "reviewers"));
    }

    @Test
    void return_the_requested_spelling_of_a_group_name() throws Exception {
        assertThat(findMemberGroups(ALICE, List.of("ops", "OPS")), containsInAnyOrder("ops", "OPS"));
    }

    @Test
    void search_in_batches() throws Exception {
        config.groupsPerQuery = 1;

        assertThat(findMemberGroups(ALICE, List.of("architects", "reviewers", "Ops")),
                containsInAnyOrder("architects", "Ops"));
    }

    @Test
    void escape_group_names_in_the_filter() throws Exception {
        assertThat(findMemberGroups(ALICE, List.of("g)(x*")), containsInAnyOrder("g)(x*"));
        assertThat(findMemberGroups(BOB, List.of("*")), is(empty()));
    }

    @Test
    void search_only_one_level_by_default() throws Exception {
        assertThat(findMemberGroups(ALICE, List.of("nested")), is(empty()));

        config.groupSearchScope = Scope.subtree;
        assertThat(findMemberGroups(ALICE, List.of("nested")), containsInAnyOrder("nested"));
    }

    @Test
    void use_the_configured_member_attribute() throws Exception {
        config.memberAttribute = "uniqueMember";

        assertThat(findMemberGroups(ALICE, List.of("unique-architects", "architects")),
                containsInAnyOrder("unique-architects"));
    }

    @Test
    void return_no_groups_for_no_candidates() throws Exception {
        assertThat(findMemberGroups(ALICE, List.of()), is(empty()));
    }

    @Test
    void fail_for_a_group_search_base_that_does_not_exist() {
        config.groupSearchBase = "ou=missing," + BASE;

        assertThrows(DirectoryException.class, () -> findMemberGroups(ALICE, List.of("architects")));
    }

    // --- Connections ---

    @Test
    void bind_anonymously_for_auth_mode_none() throws Exception {
        config.authMode = AuthMode.none;

        assertThat(findUserDn("alice"), is(Optional.of(ALICE)));
    }

    @Test
    void fail_to_open_with_a_wrong_password() {
        config.bindPassword = "wrong";

        DirectoryException e = assertThrows(DirectoryException.class, () -> new LdapDirectoryClient(config).open());
        assertThat(e.getMessage(), startsWith("Cannot connect to the LDAP directory"));
    }

    @Test
    void fail_to_open_when_nothing_listens() throws Exception {
        int port;
        try (ServerSocket socket = new ServerSocket(0)) {
            port = socket.getLocalPort();
        }
        config.url = "ldap://localhost:" + port;

        assertThrows(DirectoryException.class, () -> new LdapDirectoryClient(config).open());
    }

    @Test
    void connect_over_ldaps_with_the_configured_truststore() throws Exception {
        config.url = "ldaps://localhost:" + server.getListenPort("ldaps");
        config.truststore = keystore.toString();
        config.truststorePassword = STORE_PASSWORD;

        assertThat(findUserDn("alice"), is(Optional.of(ALICE)));
    }

    @Test
    void reject_an_untrusted_ldaps_server_without_a_truststore() {
        config.url = "ldaps://localhost:" + server.getListenPort("ldaps");

        assertThrows(DirectoryException.class, () -> new LdapDirectoryClient(config).open());
    }

    @Test
    void bind_after_start_tls() throws Exception {
        config.startTls = true;
        config.truststore = keystore.toString();
        config.truststorePassword = STORE_PASSWORD;

        assertThat(findUserDn("alice"), is(Optional.of(ALICE)));
    }

    @Test
    void reject_an_untrusted_start_tls_server_without_a_truststore() {
        config.startTls = true;

        assertThrows(DirectoryException.class, () -> new LdapDirectoryClient(config).open());
    }

    @Test
    void fail_to_create_the_client_with_a_missing_truststore() {
        config.truststore = tempDir.resolve("missing.p12").toString();

        assertThrows(IllegalStateException.class, () -> new LdapDirectoryClient(config));
    }

    @Test
    void fail_to_create_the_client_with_a_wrong_truststore_password() {
        config.truststore = keystore.toString();
        config.truststorePassword = "wrong";

        assertThrows(IllegalStateException.class, () -> new LdapDirectoryClient(config));
    }

    @Test
    void reject_an_ldaps_server_whose_certificate_does_not_match_the_host() {
        config.url = "ldaps://localhost:" + server.getListenPort("ldaps-other");
        config.truststore = otherKeystore.toString();
        config.truststorePassword = STORE_PASSWORD;

        assertThrows(DirectoryException.class, () -> new LdapDirectoryClient(config).open());
    }

    @Test
    void reject_a_start_tls_server_whose_certificate_does_not_match_the_host() {
        config.url = "ldap://localhost:" + server.getListenPort("ldap-other");
        config.startTls = true;
        config.truststore = otherKeystore.toString();
        config.truststorePassword = STORE_PASSWORD;

        assertThrows(DirectoryException.class, () -> new LdapDirectoryClient(config).open());
    }

    @Test
    void canonicalize_the_host() throws Exception {
        config.canonicalizeHost = true;
        config.url = "ldap://127.0.0.1:" + server.getListenPort("ldap");

        LdapDirectoryClient client = new LdapDirectoryClient(config);
        assertThat(client.host(new LDAPURL(config.url)), is(InetAddress.getByName("127.0.0.1").getCanonicalHostName()));
        assertThat(findUserDn("alice"), is(Optional.of(ALICE)));
    }

    @Test
    void fail_to_canonicalize_an_unknown_host() {
        config.canonicalizeHost = true;
        config.url = "ldap://host.invalid:389";

        assertThrows(DirectoryException.class, () -> new LdapDirectoryClient(config).open());
    }

    @Test
    void fail_for_an_invalid_url() {
        config.url = "ldap://bad host";

        assertThrows(DirectoryException.class, () -> new LdapDirectoryClient(config).open());
    }

    @Test
    void fail_for_an_invalid_user_search_filter() {
        config.userSearch("people").filter = "(uid={0}";

        assertThrows(DirectoryException.class, () -> findUserDn("alice"));
    }

    @Test
    void time_out_when_the_server_does_not_respond() throws Exception {
        try (ServerSocket silent = new ServerSocket(0)) {
            Thread acceptor = Thread.ofVirtual().start(() -> {
                try {
                    silent.accept();
                } catch (Exception e) {
                    // The test closes the socket.
                }
            });
            config.url = "ldap://localhost:" + silent.getLocalPort();
            config.readTimeout = Duration.ofMillis(300);

            assertThrows(DirectoryException.class, () -> new LdapDirectoryClient(config).open());
            acceptor.interrupt();
        }
    }

    @Test
    void reuse_pooled_connections() throws Exception {
        config.pool = true;
        config.poolSize = 2;
        LdapDirectoryClient client = new LdapDirectoryClient(config);
        try {
            for (int i = 0; i < 3; i++) {
                try (DirectorySession session = client.open()) {
                    assertThat(session.findUserDn("alice"), is(Optional.of(ALICE)));
                }
            }
            try (DirectorySession first = client.open(); DirectorySession second = client.open()) {
                assertThat(first.findUserDn("alice"), is(Optional.of(ALICE)));
                assertThat(second.findUserDn("bob"), is(Optional.of(BOB)));
            }
        } finally {
            client.closePool();
        }
    }

    @Test
    void discard_a_pooled_connection_after_a_failure() throws Exception {
        config.pool = true;
        LdapDirectoryClient client = new LdapDirectoryClient(config);
        try {
            config.groupSearchBase = "ou=missing," + BASE;
            try (DirectorySession session = client.open()) {
                assertThrows(DirectoryException.class, () -> session.findMemberGroups(ALICE, List.of("architects")));
            }
            config.groupSearchBase = "ou=groups," + BASE;
            try (DirectorySession session = client.open()) {
                assertThat(session.findMemberGroups(ALICE, List.of("architects")), containsInAnyOrder("architects"));
            }
        } finally {
            client.closePool();
        }
    }

    @Test
    void build_bind_requests_for_each_auth_mode() {
        config.authMode = AuthMode.none;
        assertThat(new LdapDirectoryClient(config).bindRequest(), is(nullValue()));

        config.authMode = AuthMode.simple;
        assertThat(new LdapDirectoryClient(config).bindRequest(), instanceOf(SimpleBindRequest.class));

        config.authMode = AuthMode.gssapi;
        assertThat(new LdapDirectoryClient(config).bindRequest(), instanceOf(GSSAPIBindRequest.class));
    }

    @Test
    void pass_use_subject_creds_only_to_the_gssapi_bind() {
        config.authMode = AuthMode.gssapi;
        assertThat(((GSSAPIBindRequest) new LdapDirectoryClient(config).bindRequest()).useSubjectCredentialsOnly(), is(false));

        config.gssapi.useSubjectCredsOnly = true;
        assertThat(((GSSAPIBindRequest) new LdapDirectoryClient(config).bindRequest()).useSubjectCredentialsOnly(), is(true));
    }
}
