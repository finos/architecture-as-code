package org.finos.calm.security.ldap;

import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManagerFactory;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.util.Optional;

/**
 * Builds the TLS socket factory for a configured truststore.
 */
public final class LdapTls {

    private LdapTls() {
    }

    /**
     * @throws IOException              if the truststore cannot be read.
     * @throws GeneralSecurityException if the truststore is not valid or the password is wrong.
     */
    public static SSLSocketFactory socketFactory(String truststore, Optional<String> password)
            throws IOException, GeneralSecurityException {
        File file = new File(truststore);
        if (!file.isFile()) {
            throw new FileNotFoundException("Truststore not found: " + truststore);
        }
        char[] chars = password.map(String::toCharArray).orElse(null);
        KeyStore keyStore = KeyStore.getInstance(file, chars);
        TrustManagerFactory trustManagers = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        trustManagers.init(keyStore);
        SSLContext context = SSLContext.getInstance("TLS");
        context.init(null, trustManagers.getTrustManagers(), null);
        return context.getSocketFactory();
    }
}
