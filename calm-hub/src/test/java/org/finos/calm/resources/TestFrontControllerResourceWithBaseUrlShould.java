package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.InterfaceStore;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.ResourceMappingStore;
import org.finos.calm.store.StandardStore;
import org.junit.jupiter.api.Test;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@QuarkusTest
@TestProfile(BaseUrlConfiguredProfile.class)
public class TestFrontControllerResourceWithBaseUrlShould {

    @InjectMock
    ResourceMappingStore mockMappingStore;

    @InjectMock
    PatternStore mockPatternStore;

    @InjectMock
    ArchitectureStore mockArchitectureStore;

    @InjectMock
    StandardStore mockStandardStore;

    @InjectMock
    InterfaceStore mockInterfaceStore;

    @Test
    void rewrite_id_with_friendly_url_when_base_url_configured() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));
        when(mockPatternStore.getPatternForVersion(any(Pattern.class)))
                .thenReturn("{ \"$id\": \"old-id\", \"name\": \"original\" }");

        given()
                .when()
                .get("/calm/namespaces/finos/api-gateway")
                .then()
                .statusCode(200)
                .body(containsString("https://hub.example.com/calm/namespaces/finos/api-gateway/versions/1.0.0"))
                .body(containsString("original"));
    }

    @Test
    void leave_non_object_json_unchanged_when_base_url_configured() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenReturn("[1, 2, 3]");

        given()
                .when()
                .get("/calm/namespaces/finos/api-gateway")
                .then()
                .statusCode(200)
                .body(containsString("[1, 2, 3]"));
    }

    @Test
    void leave_invalid_json_unchanged_when_base_url_configured() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenReturn("not-json");

        given()
                .when()
                .get("/calm/namespaces/finos/api-gateway")
                .then()
                .statusCode(200)
                .body(containsString("not-json"));
    }
}
