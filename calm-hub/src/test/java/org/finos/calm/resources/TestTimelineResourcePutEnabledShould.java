package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.TimelineNotFoundException;
import org.finos.calm.domain.timeline.Timeline;
import org.finos.calm.store.TimelineStore;
import org.bson.json.JsonParseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.stream.Stream;

import static io.restassured.RestAssured.given;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_MESSAGE;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.when;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
@TestProfile(AllowPutProfile.class)
@TestSecurity(authorizationEnabled = false)
public class TestTimelineResourcePutEnabledShould {

    @InjectMock
    TimelineStore mockTimelineStore;

    @Test
    void return_400_error_when_version_is_not_valid_when_updating_timeline_version() {
        String envelopeBody = "{\"name\":\"n\",\"description\":\"d\",\"timelineJson\":\"{ \\\"moments\\\": [] }\"}";

        given()
                .header("Content-Type", "application/json")
                .body(envelopeBody)
                .when()
                .put("/api/calm/namespaces/test/timelines/20/versions/1.0.invalid0")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    static Stream<Arguments> provideParametersForPutTimelineTests() {
        return Stream.of(
                Arguments.of(new NamespaceNotFoundException(), 404),
                Arguments.of(new TimelineNotFoundException(), 404),
                Arguments.of(new JsonParseException(), 400),
                Arguments.of(null, 201)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForPutTimelineTests")
    void respond_correctly_to_put_timeline_correctly(Throwable exceptionToThrow, int expectedStatusCode) throws TimelineNotFoundException, NamespaceNotFoundException {

        Timeline expectedTimeline = new Timeline.TimelineBuilder()
                .setNamespace("test")
                .setVersion("1.0.1")
                .setTimeline("{ \"moments\": [] }")
                .setId(20)
                .build();

        if (exceptionToThrow != null) {
            when(mockTimelineStore.updateTimelineForVersion(expectedTimeline)).thenThrow(exceptionToThrow);
        } else {
            when(mockTimelineStore.updateTimelineForVersion(expectedTimeline)).thenReturn(expectedTimeline);
        }

        if (expectedStatusCode == 201) {
            given()
                    .header("Content-Type", "application/json")
                    .body("{\"name\":\"n\",\"description\":\"d\",\"timelineJson\":\"{ \\\"moments\\\": [] }\"}")
                    .when()
                    .put("/api/calm/namespaces/test/timelines/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode)
                    .header("Location", containsString("/api/calm/namespaces/test/timelines/20/versions/1.0.1"));
        } else {
            given()
                    .header("Content-Type", "application/json")
                    .body("{\"name\":\"n\",\"description\":\"d\",\"timelineJson\":\"{ \\\"moments\\\": [] }\"}")
                    .when()
                    .put("/api/calm/namespaces/test/timelines/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode);
        }
    }
}
