package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

@QuarkusTest
@TestProfile(IntegrationTestPersonalNamespacesProfile.class)
public class MongoPersonalNamespacesIntegration extends PersonalNamespacesScenarios {
}
