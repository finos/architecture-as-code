package org.finos.calm.resources;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;

@QuarkusTest
@TestProfile(TestDecoratorViewResourceShould.ViewsProfile.class)
class TestDecoratorViewResourceShould {
    public static class ViewsProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("calm.extensions.dir", "src/test/resources/extensions-test/operator",
                    "calm.extensions.scanner.order", "-1");
        }
    }

    @Test
    @TestSecurity(user = "alice")
    void expose_an_operator_view_without_routes_or_backend_in_operator_order() {
        given().when().get("/api/calm/extensions").then().statusCode(200)
                .body("values.id", contains("scanner", "control-evaluation", "deployment"))
                .body("values[0].routes.size()", equalTo(0))
                .body("values[0].contributes.decorator-views[0].match.type", equalTo("security-scan"))
                .body("values[0].contributes.decorator-views[0].overlay.map.unsafe", equalTo("error"));
    }
}
