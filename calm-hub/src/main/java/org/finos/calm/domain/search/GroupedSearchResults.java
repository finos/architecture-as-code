package org.finos.calm.domain.search;

import java.util.List;

public class GroupedSearchResults {
    private final List<SearchResult> architectures;
    private final List<SearchResult> patterns;
    private final List<SearchResult> flows;
    private final List<SearchResult> standards;
    private final List<SearchResult> interfaces;
    private final List<SearchResult> controls;
    private final List<SearchResult> adrs;

    public GroupedSearchResults(List<SearchResult> architectures,
                                List<SearchResult> patterns,
                                List<SearchResult> flows,
                                List<SearchResult> standards,
                                List<SearchResult> interfaces,
                                List<SearchResult> controls,
                                List<SearchResult> adrs) {
        this.architectures = architectures;
        this.patterns = patterns;
        this.flows = flows;
        this.standards = standards;
        this.interfaces = interfaces;
        this.controls = controls;
        this.adrs = adrs;
    }

    public List<SearchResult> getArchitectures() {
        return architectures;
    }

    public List<SearchResult> getPatterns() {
        return patterns;
    }

    public List<SearchResult> getFlows() {
        return flows;
    }

    public List<SearchResult> getStandards() {
        return standards;
    }

    public List<SearchResult> getInterfaces() {
        return interfaces;
    }

    public List<SearchResult> getControls() {
        return controls;
    }

    public List<SearchResult> getAdrs() {
        return adrs;
    }
}
