package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.eclipse.microprofile.config.ConfigProvider;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.MatcherAssert.assertThat;

/**
 * Proves that application-oidc.properties' quarkus.http.auth.permission.public.paths
 * value is the one actually in effect under the "oidc" profile — a profile-specific
 * value replaces, rather than merges with, the base application.properties value for
 * the same key. A regression here (e.g. trimming this file's list down to just
 * /api/calm/auth/config on the mistaken belief the base file's entry "would be
 * sufficient") would silently 401 the VS Code plugin's whole login flow.
 */
@QuarkusTest
@TestProfile(IntegrationTestOidcProfile.class)
public class OidcPublicPathsIntegration {

    @Test
    void oidc_profiles_public_paths_include_the_plugin_auth_endpoints_not_just_the_base_entry() {
        String publicPaths = ConfigProvider.getConfig()
                .getValue("quarkus.http.auth.permission.public.paths", String.class);

        assertThat(publicPaths, containsString("/api/calm/auth/plugin-login"));
        assertThat(publicPaths, containsString("/api/calm/auth/plugin-callback"));
        assertThat(publicPaths, containsString("/api/calm/auth/config"));
    }

    @Test
    void auth_config_is_reachable_without_authentication() {
        given()
                .when().get("/api/calm/auth/config")
                .then()
                .statusCode(not(401));
    }

    @Test
    void plugin_login_is_reachable_without_authentication() {
        // No "port" query param -> 400, not 401. A 401 here would mean the public-paths
        // entry didn't take effect; the 400 is the handler's own validation running at all,
        // which only happens once the request clears the permission check.
        given()
                .when().get("/api/calm/auth/plugin-login")
                .then()
                .statusCode(not(401));
    }

    @Test
    void plugin_callback_is_reachable_without_authentication() {
        // No "code"/"state" -> 400, not 401, for the same reason as plugin-login above.
        given()
                .when().get("/api/calm/auth/plugin-callback")
                .then()
                .statusCode(not(401));
    }

    @Test
    void an_unmatched_path_under_api_calm_still_requires_authentication() {
        // Control: every real /api/calm/* resource carries its own @Authenticated or
        // @PermissionsAllowed, so asserting 401 on one of those would prove nothing about
        // this profile's own blanket "authenticated" policy (quarkus.http.auth.permission.api
        // in application-oidc.properties). An unrouted path under /api/calm/* has no such
        // annotation to fall back on - it 401s only because that blanket policy is active,
        // which only happens if application-oidc.properties genuinely loaded.
        given()
                .when().get("/api/calm/no-such-endpoint-oidc-profile-test")
                .then()
                .statusCode(401);
    }
}
