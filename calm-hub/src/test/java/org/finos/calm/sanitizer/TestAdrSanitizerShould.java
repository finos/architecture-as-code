package org.finos.calm.sanitizer;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.finos.calm.domain.adr.Decision;
import org.finos.calm.domain.adr.Link;
import org.finos.calm.domain.adr.NewAdrRequest;
import org.finos.calm.domain.adr.Option;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

@QuarkusTest
class TestAdrSanitizerShould {

    @Inject
    AdrSanitizer adrSanitizer;

    @Test
    public void remove_html_tags_from_adr() {
        NewAdrRequest unsafeNewAdrRequest = new NewAdrRequest(
                "<a href=\"http://my-url.com\"><b><i>My ADR</i></b></a>",
                "<img> <body>problem statement",
                List.of("<p><h1>decision driver"),
                List.of(new Option(
                        "<p><h1>name",
                        "<p><h1>description",
                        List.of("<p><h1> blah"),
                        List.of("<p><h1> blah")
                )),
                new Decision(new Option(
                        "<p><h1>name",
                        "<p><h1>description",
                        List.of("<p><h1> blah"),
                        List.of("<p><h1> blah")),
                        "blah <h1>"
                ),
                List.of(new Link("<p><h1> blah", "<p><h1> blah"))
        );

        NewAdrRequest expectedSafeNewAdrRequest = new NewAdrRequest(
                "My ADR",
                " problem statement",
                List.of("decision driver"),
                List.of(new Option(
                        "name",
                        "description",
                        List.of(" blah"),
                        List.of(" blah")
                )),
                new Decision(new Option(
                        "name",
                        "description",
                        List.of(" blah"),
                        List.of(" blah")),
                        "blah "
                ),
                List.of(new Link(" blah", " blah"))
        );

        assertEquals(expectedSafeNewAdrRequest, adrSanitizer.sanitizeNewAdrRequest(unsafeNewAdrRequest));
    }

    @Test
    public void handle_null_values_in_adr() {
        NewAdrRequest newAdrRequest = new NewAdrRequest(
                null,
                null,
                null,
                null,
                null,
                null
                );

        assertEquals(newAdrRequest, adrSanitizer.sanitizeNewAdrRequest(newAdrRequest));
    }

}