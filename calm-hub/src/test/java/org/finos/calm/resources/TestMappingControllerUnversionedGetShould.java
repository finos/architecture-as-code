package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.NumericResourceId;
import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.ResourceMappingStore;
import org.junit.jupiter.api.Test;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@TestSecurity(authorizationEnabled = false)
@QuarkusTest
class TestMappingControllerUnversionedGetShould {

    @InjectMock ResourceMappingStore mockMappingStore;
    @InjectMock ArchitectureStore mockArchitectureStore;

    private final NumericResourceId id = new NumericResourceId(7);

    @Test
    void return_the_highest_version_with_a_versioned_id() throws Exception {
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "api"))
                .thenReturn(mapping());
        when(mockArchitectureStore.getArchitectureVersions("finos", id))
                .thenReturn(List.of("1.0.0", "2.0.0"));
        when(mockArchitectureStore.getArchitectureForVersion("finos", id, "2.0.0"))
                .thenReturn("{\"title\":\"API\"}");

        given().get("/calm/namespaces/finos/architectures/api")
                .then().statusCode(200)
                .body(containsString("/calm/namespaces/finos/architectures/api/versions/2.0.0"));
    }

    @Test
    void return_404_when_there_is_no_version() throws Exception {
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "api"))
                .thenReturn(mapping());
        when(mockArchitectureStore.getArchitectureVersions("finos", id)).thenReturn(List.of());

        given().get("/calm/namespaces/finos/architectures/api")
                .then().statusCode(404);
    }

    @Test
    void return_404_when_the_mapping_is_missing() throws Exception {
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "missing"))
                .thenThrow(new MappingNotFoundException());

        given().get("/calm/namespaces/finos/architectures/missing")
                .then().statusCode(404);
    }

    @Test
    void return_400_for_an_unsupported_type() {
        given().get("/calm/namespaces/finos/widgets/api")
                .then().statusCode(400);
    }

    private ResourceMapping mapping() {
        return new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api")
                .setResourceType(ResourceType.ARCHITECTURE).setNumericId(7).build();
    }
}
