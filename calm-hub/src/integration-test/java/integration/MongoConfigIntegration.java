package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
class MongoConfigIntegration extends ConfigScenarios {
}
