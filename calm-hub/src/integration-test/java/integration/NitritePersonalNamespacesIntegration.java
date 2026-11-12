package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

@QuarkusTest
@TestProfile(NitritePersonalNamespacesProfile.class)
public class NitritePersonalNamespacesIntegration extends PersonalNamespacesScenarios {
}
