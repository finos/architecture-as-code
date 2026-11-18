package org.finos.calm.security;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

@QuarkusTest
@TestProfile(OidcTestProfiles.Secure.class)
class TestExtensionAssertionRejectionSecureShould extends ExtensionAssertionRejection {
}
