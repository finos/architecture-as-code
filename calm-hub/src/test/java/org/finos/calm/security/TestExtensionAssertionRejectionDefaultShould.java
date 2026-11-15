package org.finos.calm.security;

import io.quarkus.test.junit.QuarkusTest;

/**
 * The default profile has auth on and no mechanism, so it refuses every caller. The order test
 * proves little here: no other mechanism can authenticate a caller, so the order cannot change the
 * result. The 401 test is the check that matters in this profile.
 */
@QuarkusTest
class TestExtensionAssertionRejectionDefaultShould extends ExtensionAssertionRejection {
}
