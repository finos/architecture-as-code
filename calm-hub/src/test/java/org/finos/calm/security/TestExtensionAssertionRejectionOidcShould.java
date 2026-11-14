package org.finos.calm.security;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

@QuarkusTest
@TestProfile(OidcTestProfiles.Oidc.class)
class TestExtensionAssertionRejectionOidcShould extends ExtensionAssertionRejection {
}
