package org.finos.calm.store;

import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.Flow;
import org.finos.calm.domain.NumericResourceId;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.timeline.Timeline;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.Answers.CALLS_REAL_METHODS;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Covers the numeric adapter methods added to the store interfaces. */
class TestStoreResourceIdDefaultsShould {

    private final NumericResourceId id = new NumericResourceId(7);

    @Test
    void architecture_defaults_delegate_to_the_numeric_methods() throws Exception {
        ArchitectureStore store = mock(ArchitectureStore.class, CALLS_REAL_METHODS);
        when(store.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0"));
        when(store.getArchitectureForVersion(any(Architecture.class))).thenReturn("{}");

        store.getArchitectureVersions("finos", id);
        store.getArchitectureForVersion("finos", id, "1.0.0");

        verify(store).getArchitectureVersions(any(Architecture.class));
        verify(store).getArchitectureForVersion(any(Architecture.class));
    }

    @Test
    void pattern_defaults_delegate_to_the_numeric_methods() throws Exception {
        PatternStore store = mock(PatternStore.class, CALLS_REAL_METHODS);
        when(store.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));
        when(store.getPatternForVersion(any(Pattern.class))).thenReturn("{}");

        store.getPatternVersions("finos", id);
        store.getPatternForVersion("finos", id, "1.0.0");

        verify(store).getPatternVersions(any(Pattern.class));
        verify(store).getPatternForVersion(any(Pattern.class));
    }

    @Test
    void flow_defaults_delegate_to_the_numeric_methods() throws Exception {
        FlowStore store = mock(FlowStore.class, CALLS_REAL_METHODS);
        when(store.getFlowVersions(any(Flow.class))).thenReturn(List.of("1.0.0"));
        when(store.getFlowForVersion(any(Flow.class))).thenReturn("{}");

        store.getFlowVersions("finos", id);
        store.getFlowForVersion("finos", id, "1.0.0");

        verify(store).getFlowVersions(any(Flow.class));
        verify(store).getFlowForVersion(any(Flow.class));
    }

    @Test
    void timeline_defaults_delegate_to_the_numeric_methods() throws Exception {
        TimelineStore store = mock(TimelineStore.class, CALLS_REAL_METHODS);
        when(store.getTimelineVersions(any(Timeline.class))).thenReturn(List.of("1.0.0"));
        when(store.getTimelineForVersion(any(Timeline.class))).thenReturn("{}");

        store.getTimelineVersions("finos", id);
        store.getTimelineForVersion("finos", id, "1.0.0");

        verify(store).getTimelineVersions(any(Timeline.class));
        verify(store).getTimelineForVersion(any(Timeline.class));
    }

    @Test
    void standard_and_interface_defaults_delegate_to_the_numeric_methods() throws Exception {
        StandardStore standards = mock(StandardStore.class, CALLS_REAL_METHODS);
        when(standards.getStandardVersions("finos", 7)).thenReturn(List.of("1.0.0"));
        when(standards.getStandardForVersion("finos", 7, "1.0.0")).thenReturn("{}");
        standards.getStandardVersions("finos", id);
        standards.getStandardForVersion("finos", id, "1.0.0");
        verify(standards).getStandardVersions("finos", 7);
        verify(standards).getStandardForVersion("finos", 7, "1.0.0");

        InterfaceStore interfaces = mock(InterfaceStore.class, CALLS_REAL_METHODS);
        when(interfaces.getInterfaceVersions("finos", 7)).thenReturn(List.of("1.0.0"));
        when(interfaces.getInterfaceForVersion("finos", 7, "1.0.0")).thenReturn("{}");
        interfaces.getInterfaceVersions("finos", id);
        interfaces.getInterfaceForVersion("finos", id, "1.0.0");
        verify(interfaces).getInterfaceVersions("finos", 7);
        verify(interfaces).getInterfaceForVersion("finos", 7, "1.0.0");
    }

    @Test
    void control_defaults_delegate_to_the_numeric_methods() throws Exception {
        ControlStore store = mock(ControlStore.class, CALLS_REAL_METHODS);
        when(store.getRequirementVersions("security", 7)).thenReturn(List.of("1.0.0"));
        when(store.getRequirementForVersion("security", 7, "1.0.0")).thenReturn("{}");

        store.getRequirementVersions("security", id);
        store.getRequirementForVersion("security", id, "1.0.0");

        verify(store).getRequirementVersions("security", 7);
        verify(store).getRequirementForVersion("security", 7, "1.0.0");
    }

    @Test
    void convention_defaults_delegate_to_the_numeric_methods() throws Exception {
        ConventionStore store = mock(ConventionStore.class, CALLS_REAL_METHODS);
        ConventionType type = ConventionType.C4_MAPPING;
        when(store.getConventionVersions("finos", type, 7)).thenReturn(List.of("1.0.0"));
        when(store.getConventionForVersion("finos", type, 7, "1.0.0")).thenReturn("{}");

        store.getConventionVersions("finos", type, id);
        store.getConventionForVersion("finos", type, id, "1.0.0");

        verify(store).getConventionVersions("finos", type, 7);
        verify(store).getConventionForVersion("finos", type, 7, "1.0.0");
    }
}
