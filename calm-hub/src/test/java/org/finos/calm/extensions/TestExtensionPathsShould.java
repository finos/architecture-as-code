package org.finos.calm.extensions;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.net.URI;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestExtensionPathsShould {

    @ParameterizedTest
    @ValueSource(strings = {"/screen", "/namespaces/finos.payments/services", "/a:b", "/a%20b", "/a-b_c~d", "/a%3Bv%3D1",
            "/a%E2%88%94b", "/a%C3%A9"})
    void accept_a_normal_path(String path) {
        assertThat(ExtensionPaths.checkPath(path), is(path));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {
            "screen", "/../admin", "/a/..", "/a/../b", "/..;/admin", "/%2e%2e/admin", "/%2E%2E/admin", "/.%2e/admin",
            "/%252e%252e/admin", "/%25252e/admin", "/a%5cb", "/a\\b", "//evil.example.com/x",
            "/a//b", "/@evil.example.com", "/a@b", "/a%40b", "/./a", "/a/.", "/a%00b", "/a%0d%0ab", "/a%7fb",
            "/a b", "/a\tb", "/a?b", "/a#b", "/ä", "/a{b}", "/services/%2561dmin", "/a%", "/a%gg",
            "/services/a%2Fb", "/services/a%2fb", "/services/a%252Fb", "/services/a%25252fb",
            "/a;v=1", "/a;", "/;/b", "/a%E2%81%84b", "/a%E2%88%95b", "/a%e2%88%95b", "/a%E2%88%96b", "/a%E2%A7%B5b",
            "/a%E2%A7%B8b", "/a%EF%B9%A8b", "/a%EF%BC%8Fb", "/a%ef%bc%bcb", "/a%E2%80%A5b", "/a%E2%80%A4b", "/a%CD%BEb",
            "/a%EF%BC%85b", "/a%EF%BC%A0b", "/a%EF%BC%9Bb"
    })
    void reject_a_path_that_could_leave_the_route(String path) {
        ExtensionProxyException e = assertThrows(ExtensionProxyException.class, () -> ExtensionPaths.checkPath(path));

        assertThat(e.status(), is(400));
        assertThat(e.getMessage(), equalTo("The extension path or query is not allowed"));
    }

    @Test
    void normalise_unreserved_characters_and_escape_case() {
        assertThat(ExtensionPaths.checkPath("/s%65rvices/%61%44min%3a%7e%5f%2d%39"),
                is("/services/aDmin%3A~_-9"));
    }

    @Test
    void sort_the_query_by_name_and_keep_the_order_of_repeated_names() {
        assertThat(ExtensionPaths.canonicalQuery("tag=b&q=x&tag=a&&"), is("q=x&tag=b&tag=a"));
        assertThat(ExtensionPaths.canonicalQuery("flag&b=1"), is("b=1&flag"));
        assertThat(ExtensionPaths.canonicalQuery(null), is(""));
        assertThat(ExtensionPaths.canonicalQuery(""), is(""));
    }

    @ParameterizedTest
    @ValueSource(strings = {"a=%00", "a=%0A", "a=b c", "a=b#c", "a=ä"})
    void reject_a_query_with_a_control_character_or_a_fragment(String query) {
        assertThat(assertThrows(ExtensionProxyException.class, () -> ExtensionPaths.canonicalQuery(query)).status(), is(400));
    }

    @Test
    void resolve_under_the_backend_path() {
        assertThat(ExtensionPaths.resolve(URI.create("https://services.internal:8443/api"), "/screen?a=1"),
                equalTo(URI.create("https://services.internal:8443/api/screen?a=1")));
        assertThat(ExtensionPaths.resolve(URI.create("https://services.internal/api/"), "/screen"),
                equalTo(URI.create("https://services.internal/api/screen")));
        assertThat(ExtensionPaths.resolve(URI.create("http://localhost:8091"), "/a:b"),
                equalTo(URI.create("http://localhost:8091/a:b")));
    }

    @Test
    void reject_a_resolved_uri_that_leaves_the_backend() {
        URI backend = URI.create("https://services.internal/api");

        assertThat(assertThrows(ExtensionProxyException.class,
                () -> ExtensionPaths.resolve(backend, "/../../other")).status(), is(400));
        assertThat(assertThrows(ExtensionProxyException.class,
                () -> ExtensionPaths.resolve(backend, "/a|b")).status(), is(400));
    }
}
