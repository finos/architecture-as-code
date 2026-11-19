package org.finos.calm.services;

import jakarta.enterprise.inject.Instance;
import org.finos.calm.domain.GitHubResourceId;
import org.finos.calm.domain.NumericResourceId;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.ResourceId;
import org.finos.calm.resources.CalmDocumentParser;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.ControlStore;
import org.finos.calm.store.DomainStore;
import org.finos.calm.store.FlowStore;
import org.finos.calm.store.InterfaceStore;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.ResourceMappingStore;
import org.finos.calm.store.StandardStore;
import org.finos.calm.store.TimelineStore;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestMappingControllerServiceResourceIdsShould {

    @Mock private ResourceMappingStore mappingStore;
    @Mock private PatternStore patternStore;
    @Mock private ArchitectureStore architectureStore;
    @Mock private FlowStore flowStore;
    @Mock private StandardStore standardStore;
    @Mock private InterfaceStore interfaceStore;
    @Mock private TimelineStore timelineStore;
    @Mock private DomainStore domainStore;
    @Mock private ControlStore controlStore;
    @Mock private CalmDocumentParser documentParser;
    @Mock private Instance<GitHubCloneManager> cloneManagers;

    private MappingControllerService service;
    private final NumericResourceId id = new NumericResourceId(7);

    @BeforeEach
    void setup() {
        service = new MappingControllerService(mappingStore, patternStore, architectureStore,
                flowStore, standardStore, interfaceStore, timelineStore, domainStore,
                controlStore, documentParser, cloneManagers);
    }

    @Test
    void route_version_lists_for_every_resource_type() throws Exception {
        when(patternStore.getPatternVersions(anyString(), any())).thenReturn(List.of("1.0.0"));
        when(architectureStore.getArchitectureVersions(anyString(), any())).thenReturn(List.of("1.0.0"));
        when(flowStore.getFlowVersions(anyString(), any())).thenReturn(List.of("1.0.0"));
        when(standardStore.getStandardVersions(anyString(), any(ResourceId.class))).thenReturn(List.of("1.0.0"));
        when(interfaceStore.getInterfaceVersions(anyString(), any(ResourceId.class))).thenReturn(List.of("1.0.0"));
        when(timelineStore.getTimelineVersions(anyString(), any())).thenReturn(List.of("1.0.0"));

        for (ResourceType type : ResourceType.values()) {
            assertThat(service.getVersions("finos", type, id), equalTo(List.of("1.0.0")));
        }
    }

    @Test
    void route_version_content_for_every_resource_type() throws Exception {
        when(patternStore.getPatternForVersion(anyString(), any(), anyString())).thenReturn("{}");
        when(architectureStore.getArchitectureForVersion(anyString(), any(), anyString())).thenReturn("{}");
        when(flowStore.getFlowForVersion(anyString(), any(), anyString())).thenReturn("{}");
        when(standardStore.getStandardForVersion(anyString(), any(ResourceId.class), anyString())).thenReturn("{}");
        when(interfaceStore.getInterfaceForVersion(anyString(), any(ResourceId.class), anyString())).thenReturn("{}");
        when(timelineStore.getTimelineForVersion(anyString(), any(), anyString())).thenReturn("{}");

        for (ResourceType type : ResourceType.values()) {
            assertThat(service.getResourceJson("finos", type, id, "1.0.0"), equalTo("{}"));
        }
    }

    @Test
    void pick_the_highest_numeric_version() throws Exception {
        when(architectureStore.getArchitectureVersions("finos", id)).thenReturn(List.of("1.10.0", "1.2.0", "2.0.0"));
        assertThat(service.resolveLatestVersion("finos", ResourceType.ARCHITECTURE, id), equalTo("2.0.0"));
    }

    @Test
    void return_null_when_no_numeric_version_exists() throws Exception {
        when(architectureStore.getArchitectureVersions("finos", id)).thenReturn(List.of());
        assertThat(service.resolveLatestVersion("finos", ResourceType.ARCHITECTURE, id), nullValue());
    }

    @Test
    void use_the_clone_head_for_a_github_id() throws Exception {
        GitHubResourceId github = new GitHubResourceId("api", null, null);
        assertThat(service.resolveLatestVersion("finos", ResourceType.ARCHITECTURE, github), nullValue());

        GitHubCloneManager manager = mock(GitHubCloneManager.class);
        when(cloneManagers.isResolvable()).thenReturn(true);
        when(cloneManagers.get()).thenReturn(manager);
        when(manager.headSha("finos")).thenReturn("abc1234");
        assertThat(service.resolveLatestVersion("finos", ResourceType.ARCHITECTURE, github), equalTo("abc1234"));
    }
}
