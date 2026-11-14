package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
class NitriteConfigIntegration extends ConfigScenarios {
}
