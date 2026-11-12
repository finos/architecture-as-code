package org.finos.calm.security.ldap;

import com.unboundid.ldap.sdk.BindRequest;
import com.unboundid.ldap.sdk.ExtendedResult;
import com.unboundid.ldap.sdk.GSSAPIBindRequest;
import com.unboundid.ldap.sdk.GSSAPIBindRequestProperties;
import com.unboundid.ldap.sdk.LDAPConnection;
import com.unboundid.ldap.sdk.LDAPConnectionOptions;
import com.unboundid.ldap.sdk.LDAPConnectionPool;
import com.unboundid.ldap.sdk.LDAPException;
import com.unboundid.ldap.sdk.LDAPURL;
import com.unboundid.ldap.sdk.ResultCode;
import com.unboundid.ldap.sdk.SimpleBindRequest;
import com.unboundid.ldap.sdk.SingleServerSet;
import com.unboundid.ldap.sdk.extensions.StartTLSExtendedRequest;
import com.unboundid.util.ssl.HostNameSSLSocketVerifier;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.config.LdapGroupsConfig;
import org.finos.calm.security.GroupMembershipResolverProducer;

import javax.net.SocketFactory;
import javax.net.ssl.SSLSocketFactory;
import java.io.IOException;
import java.net.InetAddress;
import java.security.GeneralSecurityException;

/**
 * Opens LDAP sessions with the UnboundID LDAP SDK. Each session has its own connection, or
 * borrows one from a pool when {@code pool=true}.
 */
@LookupIfProperty(name = GroupMembershipResolverProducer.PROVIDER_PROPERTY, stringValue = GroupMembershipResolverProducer.LDAP)
@Typed({LdapDirectoryClient.class, DirectoryClient.class})
@ApplicationScoped
public class LdapDirectoryClient implements DirectoryClient {

    private final LdapGroupsConfig config;
    private final SSLSocketFactory sslSocketFactory;
    private final LDAPConnectionOptions options;
    private LDAPConnectionPool pool;

    @Inject
    public LdapDirectoryClient(LdapGroupsConfig config) {
        this.config = config;
        this.sslSocketFactory = config.truststore()
                .map(this::loadTruststore)
                .orElseGet(() -> (SSLSocketFactory) SSLSocketFactory.getDefault());
        this.options = new LDAPConnectionOptions();
        options.setConnectTimeoutMillis(Math.toIntExact(config.connectTimeout().toMillis()));
        options.setResponseTimeoutMillis(config.readTimeout().toMillis());
        options.setAbandonOnTimeout(true);
        options.setFollowReferrals(false);
        options.setSSLSocketVerifier(new HostNameSSLSocketVerifier(true));
    }

    @Override
    public DirectorySession open() throws DirectoryException {
        try {
            if (config.pool()) {
                LDAPConnectionPool connections = pool();
                return new LdapDirectorySession(connections.getConnection(), config, connections);
            }
            return new LdapDirectorySession(connect(), config, null);
        } catch (LDAPException e) {
            throw new DirectoryException("Cannot connect to the LDAP directory: " + e.getMessage(), e);
        }
    }

    private LDAPConnection connect() throws LDAPException, DirectoryException {
        LDAPURL url = url();
        LDAPConnection connection = new LDAPConnection(socketFactory(url), options, host(url), url.getPort());
        try {
            if (config.startTls()) {
                ExtendedResult result = connection.processExtendedOperation(new StartTLSExtendedRequest(sslSocketFactory));
                if (result.getResultCode() != ResultCode.SUCCESS) {
                    throw new LDAPException(result);
                }
            }
            BindRequest bind = bindRequest();
            if (bind != null) {
                connection.bind(bind);
            }
            return connection;
        } catch (LDAPException | RuntimeException e) {
            connection.close();
            throw e;
        }
    }

    private synchronized LDAPConnectionPool pool() throws LDAPException, DirectoryException {
        if (pool == null) {
            LDAPURL url = url();
            pool = new LDAPConnectionPool(new SingleServerSet(host(url), url.getPort(), socketFactory(url), options),
                    bindRequest(), 1, config.poolSize());
        }
        return pool;
    }

    @PreDestroy
    synchronized void closePool() {
        if (pool != null) {
            pool.close();
            pool = null;
        }
    }

    LDAPConnectionOptions connectionOptions() {
        return options;
    }

    BindRequest bindRequest() {
        return switch (config.authMode().orElse(LdapGroupsConfig.AuthMode.none)) {
            case none -> null;
            case simple -> new SimpleBindRequest(config.bindDn().orElse(""), config.bindPassword().orElse(""));
            case gssapi -> {
                GSSAPIBindRequestProperties properties = new GSSAPIBindRequestProperties(null, (String) null);
                properties.setUseTicketCache(true);
                properties.setRequireCachedCredentials(true);
                properties.setUseSubjectCredentialsOnly(config.gssapi().useSubjectCredsOnly());
                properties.setServicePrincipalProtocol("ldap");
                yield gssapiBindRequest(properties);
            }
        };
    }

    private static GSSAPIBindRequest gssapiBindRequest(GSSAPIBindRequestProperties properties) {
        try {
            return new GSSAPIBindRequest(properties);
        } catch (LDAPException e) {
            throw new IllegalStateException("Cannot create the GSSAPI bind request", e);
        }
    }

    private LDAPURL url() throws DirectoryException {
        try {
            return new LDAPURL(config.url().orElseThrow());
        } catch (LDAPException e) {
            throw new DirectoryException("Invalid LDAP URL: " + e.getMessage(), e);
        }
    }

    String host(LDAPURL url) throws DirectoryException {
        if (!config.canonicalizeHost()) {
            return url.getHost();
        }
        try {
            return InetAddress.getByName(url.getHost()).getCanonicalHostName();
        } catch (IOException e) {
            throw new DirectoryException("Cannot canonicalize the LDAP host: " + e.getMessage(), e);
        }
    }

    private SocketFactory socketFactory(LDAPURL url) {
        return "ldaps".equalsIgnoreCase(url.getScheme()) ? sslSocketFactory : SocketFactory.getDefault();
    }

    private SSLSocketFactory loadTruststore(String path) {
        try {
            return LdapTls.socketFactory(path, config.truststorePassword());
        } catch (IOException | GeneralSecurityException e) {
            throw new IllegalStateException("Cannot load the LDAP truststore " + path, e);
        }
    }
}
