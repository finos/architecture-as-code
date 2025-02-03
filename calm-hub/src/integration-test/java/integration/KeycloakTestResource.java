package integration;

import dasniko.testcontainers.keycloak.KeycloakContainer;
import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.Objects;

public class KeycloakTestResource implements QuarkusTestResourceLifecycleManager {
    private KeycloakContainer keycloakContainer;
    private static final Logger logger = LoggerFactory.getLogger(KeycloakTestResource.class);

    @Override
    public Map<String, String> start() {
        if (Objects.isNull(keycloakContainer)) {
            keycloakContainer = new KeycloakContainer("quay.io/keycloak/keycloak:26.1")
                    .withBootstrapAdminDisabled()
                    .withAdminUsername("admin")
                    .withAdminPassword("admin")
                    .withRealmImportFile("/secure-profile/realm.json")
                    .withContextPath("/auth");
        }

        logger.info("Starting keycloakContainer container");
        keycloakContainer.start();
        String authServerUrl = keycloakContainer.getAuthServerUrl() + "/realms/calm-hub-realm";
        logger.info("quarkus.oidc.auth-server-url: {}", authServerUrl);
        System.setProperty("quarkus.oidc.auth-server-url", authServerUrl);
        return Map.of("quarkus.oidc.auth-server-url", authServerUrl);
    }

    @Override
    public void stop() {
        keycloakContainer.stop();
    }
}
