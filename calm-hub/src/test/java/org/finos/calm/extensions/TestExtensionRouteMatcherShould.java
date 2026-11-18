package org.finos.calm.extensions;

import org.finos.calm.domain.extensions.ExtensionManifest;
import org.finos.calm.domain.extensions.ExtensionManifest.Route;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestExtensionRouteMatcherShould {

    private static final ExtensionManifest MANIFEST = new ExtensionManifest("team-services", "1.0.0", 0, "Team services",
            null, null, List.of(
            new Route("screen", "GET", "/screen", "authenticated", false),
            new Route("services", "GET", "/namespaces/{namespace}/services", "read", false),
            new Route("add-service", "POST", "/namespaces/{namespace}/services", "write", false),
            new Route("service", "GET", "/namespaces/{namespace}/services/{service}", "read", false),
            new Route("new-service", "GET", "/namespaces/{namespace}/services/new", "read", false)),
            null, null);

    @Test
    void match_a_literal_route() {
        ExtensionRouteMatcher.RouteMatch match = ExtensionRouteMatcher.match(MANIFEST, "GET", "/screen");

        assertThat(match.route().id(), is("screen"));
        assertThat(match.parameters(), equalTo(Map.of()));
    }

    @Test
    void match_by_method_and_keep_the_raw_parameters() {
        ExtensionRouteMatcher.RouteMatch match =
                ExtensionRouteMatcher.match(MANIFEST, "POST", "/namespaces/finos.payments/services");

        assertThat(match.route().id(), is("add-service"));
        assertThat(match.parameters(), equalTo(Map.of("namespace", "finos.payments")));
        assertThat(ExtensionRouteMatcher.match(MANIFEST, "GET", "/namespaces/a/services/b%20c").parameters(),
                equalTo(Map.of("namespace", "a", "service", "b%20c")));
    }

    @Test
    void prefer_the_route_with_more_literal_segments() {
        assertThat(ExtensionRouteMatcher.match(MANIFEST, "GET", "/namespaces/a/services/new").route().id(), is("new-service"));
        assertThat(ExtensionRouteMatcher.match(MANIFEST, "GET", "/namespaces/a/services/old").route().id(), is("service"));
    }

    @Test
    void return_404_for_a_path_that_no_route_declares() {
        for (String path : List.of("/admin", "/screen/", "/namespaces//services", "/namespaces/a/services/b/c", "/")) {
            assertThat(path, assertThrows(ExtensionProxyException.class,
                    () -> ExtensionRouteMatcher.match(MANIFEST, "GET", path)).status(), is(404));
        }
    }

    @Test
    void return_405_for_a_declared_path_with_another_method() {
        ExtensionProxyException e = assertThrows(ExtensionProxyException.class,
                () -> ExtensionRouteMatcher.match(MANIFEST, "DELETE", "/namespaces/a/services"));

        assertThat(e.status(), is(405));
        assertThat(e.headers(), equalTo(Map.of("Allow", "GET, HEAD, POST")));
    }

    @Test
    void list_head_with_get_and_only_the_accepted_routes_in_allow() {
        ExtensionProxyException e = assertThrows(ExtensionProxyException.class,
                () -> ExtensionRouteMatcher.match(MANIFEST, "DELETE", "/namespaces/a/services",
                        route -> "GET".equals(route.method())));

        assertThat(e.headers(), equalTo(Map.of("Allow", "GET, HEAD")));
        assertThat(ExtensionRouteMatcher.allowedMethods(MANIFEST, "/namespaces/a/services",
                route -> !"GET".equals(route.method())), is("POST"));
    }
}
