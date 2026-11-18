package org.finos.calm.extensions;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Map;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;

class TestNotationCheckerShould {

    private final NotationChecker checker = new NotationChecker();

    @Test
    void ship_a_core_notation_with_a_box_and_the_common_edge_markers() {
        JsonObject core = new JsonObject(read());
        assertThat(core.getJsonObject("shapes").fieldNames(), contains("Box"));
        assertThat(core.getJsonObject("markers").fieldNames(), hasItem("hollow-triangle"));
        assertThat(checker.check(core.getMap()), empty());
    }

    @Test
    void accept_an_author_shape_with_a_pinned_glyph_slots_ports_and_its_own_marker() {
        JsonObject notation = new JsonObject()
                .put("shapes", new JsonObject().put("app-component", new JsonObject()
                        .put("viewBox", new JsonArray().add(0).add(0).add(120).add(60))
                        .put("resize", new JsonObject().put("mode", "nine-slice").put("insets", new JsonArray().add(8).add(8).add(8).add(8)))
                        .put("parts", new JsonArray()
                                .add(new JsonObject().put("rect", new JsonObject().put("x", 0).put("y", 0).put("width", 120).put("height", 60)))
                                .add(new JsonObject().put("path", "M100,6h12v14h-12z M96 9h8v3h-8z").put("fill", "none")
                                        .put("stroke", "color").put("pin", "top-right")))
                        .put("slots", new JsonObject().put("label", new JsonObject().put("x", 8).put("y", 8).put("width", 84).put("height", 18)))
                        .put("ports", new JsonArray().add(new JsonObject().put("id", "in").put("side", "left").put("offset", 0.5)))))
                .put("markers", new JsonObject().put("realisation", new JsonObject()
                        .put("viewBox", new JsonArray().add(0).add(0).add(14).add(14))
                        .put("parts", new JsonArray().add(new JsonObject().put("polygon",
                                new JsonArray().add(new JsonArray().add(0).add(0)).add(new JsonArray().add(14).add(7)).add(new JsonArray().add(0).add(14)))))))
                .put("styles", new JsonObject()
                        .put("elements", new JsonArray().add(new JsonObject().put("tag", "Application Component").put("shape", "app-component")))
                        .put("relationships", new JsonArray().add(new JsonObject().put("tag", "Realization").put("end", "realisation").put("start", "core/dot"))));

        assertThat(checker.check(notation.getMap()), empty());
    }

    @Test
    void reject_markup_that_is_not_geometry() {
        JsonObject part = new JsonObject().put("rect", new JsonObject().put("x", 0).put("y", 0).put("width", 1).put("height", 1))
                .put("href", "https://example.org/track.png");
        JsonObject notation = new JsonObject().put("shapes", new JsonObject().put("x", new JsonObject()
                .put("viewBox", new JsonArray().add(0).add(0).add(10).add(10))
                .put("parts", new JsonArray().add(part).add(new JsonObject().put("text", "hello")))));

        assertThat(String.join("; ", checker.check(notation.getMap())), containsString("/shapes/x/parts/0"));
    }

    @Test
    void reject_a_remote_icon() {
        JsonObject notation = new JsonObject().put("styles", new JsonObject().put("elements", new JsonArray()
                .add(new JsonObject().put("tag", "A").put("icon", "https://example.org/a.png"))));

        assertThat(String.join("; ", checker.check(notation.getMap())), containsString("/styles/elements/0/icon"));
    }

    @Test
    void reject_slots_outside_the_view_box_two_growing_slots_and_insets_with_no_middle() {
        JsonObject slot = new JsonObject().put("x", 0).put("y", 0).put("width", 10).put("height", 5).put("grow", true);
        JsonObject notation = new JsonObject().put("shapes", new JsonObject().put("x", new JsonObject()
                .put("viewBox", new JsonArray().add(0).add(0).add(10).add(10))
                .put("resize", new JsonObject().put("mode", "nine-slice").put("insets", new JsonArray().add(5).add(1).add(5).add(1)))
                .put("parts", new JsonArray().add(new JsonObject().put("path", "M0 0H10V10Z")))
                .put("slots", new JsonObject().put("a", slot).put("b", slot.copy().put("x", 4)))));

        assertThat(checker.check(notation.getMap()), contains(
                "/shapes/x/resize: the insets leave no middle to stretch",
                "/shapes/x/slots/b: is outside the viewBox",
                "/shapes/x/slots: only one slot can grow"));
    }

    @Test
    void resolve_a_shape_in_the_notation_or_the_core_notation_only() {
        JsonObject notation = new JsonObject()
                .put("shapes", new JsonObject().put("Box", new JsonObject()
                        .put("viewBox", new JsonArray().add(0).add(0).add(10).add(10))
                        .put("parts", new JsonArray().add(new JsonObject().put("path", "M0 0H10V10Z")))))
                .put("styles", new JsonObject().put("elements", new JsonArray()
                        .add(new JsonObject().put("tag", "A").put("shape", "Box"))
                        .add(new JsonObject().put("tag", "B").put("shape", "core/Box"))
                        .add(new JsonObject().put("tag", "C").put("shape", "Person"))
                        .add(new JsonObject().put("tag", "D").put("shape", "core/Person"))));

        assertThat(checker.check(notation.getMap()), contains(
                "/styles/elements/2/shape: 'Person' is not a shape of this notation or of the core notation",
                "/styles/elements/3/shape: 'core/Person' is not a shape of this notation or of the core notation"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"M0 0 L10 10 Z", "m1,2 l3-4z", "M0 0 A5 5 0 0 1 10 0 L 1e2 .5", "M0 0 H10 V10 H0 Z M2 2 h1"})
    void accept_a_path_of_commands_and_numbers(String data) {
        assertThat(NotationChecker.pathProblem(data), equalTo(Optional.empty()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"L0 0", "M0 0 L10", "M0 0 Z 1", "M0 0 url(#x)", "M0 0 L1e9 0", "", "M0 0 C1 2 3 4 5"})
    void reject_a_path_that_is_not_whole_commands_and_numbers(String data) {
        assertThat(NotationChecker.pathProblem(data).isPresent(), equalTo(true));
    }

    private static Map<String, Object> read() {
        try (var in = NotationChecker.class.getClassLoader().getResourceAsStream(NotationChecker.CORE_PATH)) {
            return new JsonObject(new String(in.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8)).getMap();
        } catch (java.io.IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
    }
}
