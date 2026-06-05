package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.TimelineNotFoundException;
import org.finos.calm.domain.exception.TimelineVersionExistsException;
import org.finos.calm.domain.exception.TimelineVersionNotFoundException;
import org.finos.calm.domain.timeline.CreateTimelineRequest;
import org.finos.calm.domain.timeline.NamespaceTimelineSummary;
import org.finos.calm.domain.timeline.Timeline;
import org.finos.calm.store.TimelineStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

import static io.restassured.RestAssured.given;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_MESSAGE;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@TestSecurity(authorizationEnabled = false)
@QuarkusTest
public class TestTimelineResourceShould {

    @InjectMock
    TimelineStore mockTimelineStore;

    @Test
    void return_a_404_when_an_invalid_namespace_is_provided_on_get_timelines() throws NamespaceNotFoundException {
        when(mockTimelineStore.getTimelinesForNamespace(anyString())).thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/invalid/timelines")
                .then()
                .statusCode(404);

        verify(mockTimelineStore, times(1)).getTimelinesForNamespace("invalid");
    }

    @Test
    void return_a_400_when_an_invalid_format_of_namespace_is_provided_on_get_timelines() {
        given()
                .when()
                .get("/calm/namespaces/fin_os/timelines")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    @Test
    void return_list_of_timeline_summaries_when_valid_namespace_provided_on_get_timelines() throws NamespaceNotFoundException {
        List<NamespaceTimelineSummary> summaries = Arrays.asList(
                new NamespaceTimelineSummary("Timeline One", "First", 12345),
                new NamespaceTimelineSummary("Timeline Two", "Second", 54321)
        );
        when(mockTimelineStore.getTimelinesForNamespace(anyString())).thenReturn(summaries);

        given()
                .when()
                .get("/calm/namespaces/valid/timelines")
                .then()
                .statusCode(200)
                .body("values[0].name", equalTo("Timeline One"))
                .body("values[0].description", equalTo("First"))
                .body("values[0].id", equalTo(12345))
                .body("values[1].name", equalTo("Timeline Two"))
                .body("values[1].description", equalTo("Second"))
                .body("values[1].id", equalTo(54321));

        verify(mockTimelineStore, times(1)).getTimelinesForNamespace("valid");
    }

    @Test
    void return_a_404_when_invalid_namespace_is_provided_on_create_timeline() throws NamespaceNotFoundException {
        when(mockTimelineStore.createTimelineForNamespace(any(CreateTimelineRequest.class), anyString()))
                .thenThrow(new NamespaceNotFoundException());

        String requestBody = "{ \"name\": \"Test\", \"description\": \"desc\", \"timelineJson\": \"{ \\\"moments\\\": [] }\" }";

        given()
                .header("Content-Type", "application/json")
                .body(requestBody)
                .when()
                .post("/calm/namespaces/invalid/timelines")
                .then()
                .statusCode(404);

        verify(mockTimelineStore, times(1)).createTimelineForNamespace(any(CreateTimelineRequest.class), eq("invalid"));
    }

    @Test
    void return_a_400_when_invalid_timeline_json_is_provided_on_create_timeline() throws NamespaceNotFoundException {
        when(mockTimelineStore.createTimelineForNamespace(any(CreateTimelineRequest.class), anyString()))
                .thenThrow(new JsonParseException());

        String requestBody = "{ \"name\": \"Test\", \"description\": \"desc\", \"timelineJson\": \"invalid json\" }";

        given()
                .header("Content-Type", "application/json")
                .body(requestBody)
                .when()
                .post("/calm/namespaces/invalid/timelines")
                .then()
                .statusCode(400);

        verify(mockTimelineStore, times(1)).createTimelineForNamespace(any(CreateTimelineRequest.class), eq("invalid"));
    }

    @Test
    void return_a_created_with_location_of_timeline_when_creating_timeline() throws NamespaceNotFoundException {
        String timelineJson = "{ \"moments\": [] }";
        String namespace = "valid";

        Timeline stubbedReturnTimeline = new Timeline.TimelineBuilder()
                .setTimeline(timelineJson)
                .setVersion("1.0.0")
                .setId(12)
                .setNamespace(namespace)
                .build();

        when(mockTimelineStore.createTimelineForNamespace(any(CreateTimelineRequest.class), eq(namespace))).thenReturn(stubbedReturnTimeline);

        String requestBody = "{ \"name\": \"Test\", \"description\": \"desc\", \"timelineJson\": \"{ \\\"moments\\\": [] }\" }";

        given()
                .header("Content-Type", "application/json")
                .body(requestBody)
                .when()
                .post("/calm/namespaces/valid/timelines")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/valid/timelines/12/versions/1.0.0"));

        verify(mockTimelineStore, times(1)).createTimelineForNamespace(any(CreateTimelineRequest.class), eq(namespace));
    }

    static Stream<Arguments> provideParametersForTimelineVersionTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new TimelineNotFoundException(), 404),
                Arguments.of("valid", null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForTimelineVersionTests")
    void respond_correctly_to_get_timeline_versions_query(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws TimelineNotFoundException, NamespaceNotFoundException {
        var versions = List.of("1.0.0", "1.0.1");
        if (exceptionToThrow != null) {
            when(mockTimelineStore.getTimelineVersions(any(Timeline.class))).thenThrow(exceptionToThrow);
        } else {
            when(mockTimelineStore.getTimelineVersions(any(Timeline.class))).thenReturn(versions);
        }

        if (expectedStatusCode == 200) {
            String expectedBody = "{\"values\":[\"1.0.0\",\"1.0.1\"]}";
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/timelines/12/versions")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body(equalTo(expectedBody));
        } else {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/timelines/12/versions")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        Timeline expectedTimelineToRetrieve = new Timeline.TimelineBuilder()
                .setNamespace(namespace)
                .setId(12)
                .build();

        verify(mockTimelineStore, times(1)).getTimelineVersions(expectedTimelineToRetrieve);
    }

    @Test
    void return_a_400_when_an_invalid_format_of_namespace_is_provided_on_get_timeline_versions() {
        given()
                .when()
                .get("/calm/namespaces/fin_os/timelines/12/versions")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    @Test
    void return_400_error_when_version_is_not_valid_when_getting_timeline_version() {
        given()
                .when()
                .get("/calm/namespaces/finos/timelines/12/versions/1.0.invalid0")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    static Stream<Arguments> provideParametersForGetTimelineTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new TimelineNotFoundException(), 404),
                Arguments.of("valid", new TimelineVersionNotFoundException(), 404),
                Arguments.of("valid", null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForGetTimelineTests")
    void respond_correctly_to_get_timeline_for_a_specific_version_correctly(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws TimelineVersionNotFoundException, TimelineNotFoundException, NamespaceNotFoundException {
        if (exceptionToThrow != null) {
            when(mockTimelineStore.getTimelineForVersion(any(Timeline.class))).thenThrow(exceptionToThrow);
        } else {
            String timeline = "{ \"moments\": [] }";
            when(mockTimelineStore.getTimelineForVersion(any(Timeline.class))).thenReturn(timeline);
        }

        if (expectedStatusCode == 200) {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/timelines/12/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body(equalTo("{ \"moments\": [] }"));
        } else {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/timelines/12/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        Timeline expectedTimelineToRetrieve = new Timeline.TimelineBuilder()
                .setNamespace(namespace)
                .setId(12)
                .setVersion("1.0.0")
                .build();

        verify(mockTimelineStore, times(1)).getTimelineForVersion(expectedTimelineToRetrieve);
    }

    @Test
    void return_400_error_when_version_is_not_valid_when_creating_new_timeline_version() {
        String envelopeBody = "{\"name\":\"n\",\"description\":\"d\",\"timelineJson\":\"{ \\\"moments\\\": [] }\"}";

        given()
                .header("Content-Type", "application/json")
                .body(envelopeBody)
                .when()
                .post("/calm/namespaces/test/timelines/20/versions/1.0.invalid0")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    static Stream<Arguments> provideParametersForCreateTimelineTests() {
        return Stream.of(
                Arguments.of(new NamespaceNotFoundException(), 404),
                Arguments.of(new TimelineNotFoundException(), 404),
                Arguments.of(new TimelineVersionExistsException(), 409),
                Arguments.of(new JsonParseException(), 400),
                Arguments.of(null, 201)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForCreateTimelineTests")
    void respond_correctly_to_create_timeline(Throwable exceptionToThrow, int expectedStatusCode) throws TimelineNotFoundException, TimelineVersionExistsException, NamespaceNotFoundException {
        Timeline expectedTimeline = new Timeline.TimelineBuilder()
                .setNamespace("test")
                .setVersion("1.0.1")
                .setTimeline("{ \"moments\": [] }")
                .setId(20)
                .build();

        String envelopeBody = "{\"name\":\"n\",\"description\":\"d\",\"timelineJson\":\"{ \\\"moments\\\": [] }\"}";

        if (exceptionToThrow != null) {
            when(mockTimelineStore.createTimelineForVersion(expectedTimeline)).thenThrow(exceptionToThrow);
        } else {
            when(mockTimelineStore.createTimelineForVersion(expectedTimeline)).thenReturn(expectedTimeline);
        }

        if (expectedStatusCode == 201) {
            given()
                    .header("Content-Type", "application/json")
                    .body(envelopeBody)
                    .when()
                    .post("/calm/namespaces/test/timelines/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode)
                    .header("Location", containsString("/calm/namespaces/test/timelines/20/versions/1.0.1"));
        } else {
            given()
                    .header("Content-Type", "application/json")
                    .body(envelopeBody)
                    .when()
                    .post("/calm/namespaces/test/timelines/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verify(mockTimelineStore, times(1)).createTimelineForVersion(expectedTimeline);
    }

    @Test
    void return_forbidden_for_put_operations_on_timelines_by_default() {
        given()
                .header("Content-Type", "application/json")
                .body("{\"name\":\"n\",\"description\":\"d\",\"timelineJson\":\"{ \\\"moments\\\": [] }\"}")
                .when()
                .put("/calm/namespaces/test/timelines/20/versions/1.0.1")
                .then()
                .statusCode(403);
    }
}
