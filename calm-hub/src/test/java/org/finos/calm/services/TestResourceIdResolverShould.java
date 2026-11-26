package org.finos.calm.services;

import org.finos.calm.domain.GitHubResourceId;
import org.finos.calm.domain.NumericResourceId;
import org.finos.calm.domain.ResourceId;
import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.InvalidResourceIdException;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestResourceIdResolverShould {

    @Mock
    private MappingControllerService mappingService;

    private ResourceIdResolver resolver;

    @BeforeEach
    void setup() {
        resolver = new ResourceIdResolver();
        resolver.mappingService = mappingService;
        resolver.databaseMode = "mongo";
    }

    @Test
    void resolve_a_numeric_storage_id() {
        ResourceId id = resolver.forStorage("42", null, null);
        assertThat(id, equalTo(new NumericResourceId(42)));
    }

    @Test
    void reject_a_non_numeric_storage_id_in_numeric_mode() {
        for (String rawId : new String[]{"not-a-number", "", "-5", "0", "9999999999"}) {
            assertThrows(InvalidResourceIdException.class, () -> resolver.forStorage(rawId, null, null));
        }
    }

    @Test
    void resolve_a_large_valid_numeric_storage_id() {
        assertThat(resolver.forStorage("1234567890", null, null), equalTo(new NumericResourceId(1234567890)));
    }

    @Test
    void resolve_a_composite_storage_id_in_github_mode() {
        resolver.databaseMode = "github";
        ResourceId id = resolver.forStorage("api", "aws/prod", "calm");
        assertThat(id, equalTo(new GitHubResourceId("api", "aws/prod", "calm")));
    }

    @Test
    void resolve_a_name_through_the_mapping_store_in_numeric_mode() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api").setResourceType(ResourceType.ARCHITECTURE)
                .setNumericId(7).build();
        when(mappingService.getMapping("finos", ResourceType.ARCHITECTURE, "api")).thenReturn(mapping);

        assertThat(resolver.forName("finos", ResourceType.ARCHITECTURE, "api", null, null),
                equalTo(new NumericResourceId(7)));
    }

    @Test
    void resolve_a_name_directly_in_github_mode() throws Exception {
        resolver.databaseMode = "github";
        assertThat(resolver.forName("finos", ResourceType.ARCHITECTURE, "api", "path", "v1"),
                equalTo(new GitHubResourceId("api", "path", "v1")));
    }

    @Test
    void reject_a_blank_name() {
        assertThrows(InvalidResourceIdException.class,
                () -> resolver.forName("finos", ResourceType.ARCHITECTURE, "", null, null));
    }
}
