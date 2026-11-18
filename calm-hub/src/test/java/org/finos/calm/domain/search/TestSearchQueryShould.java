package org.finos.calm.domain.search;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;

class TestSearchQueryShould {

    private static final SearchResult RESULT = new SearchResult("finos", 1, "Name", "Description");

    @Test
    void keep_plain_text_without_qualifiers() {
        SearchQuery query = SearchQuery.parse("trade platform");

        assertThat(query.text(), is("trade platform"));
        assertThat(query.namespace(), is(Optional.empty()));
        assertThat(query.type(), is(Optional.empty()));
    }

    @Test
    void read_qualifiers_with_and_without_a_space_after_the_colon() {
        SearchQuery query = SearchQuery.parse("namespace: finos.calm trade type:Pattern");

        assertThat(query.text(), is("trade"));
        assertThat(query.namespace(), is(Optional.of("finos.calm")));
        assertThat(query.type(), is(Optional.of("pattern")));
    }

    @Test
    void read_ns_as_namespace() {
        assertThat(SearchQuery.parse("ns:workshop").namespace(), is(Optional.of("workshop")));
    }

    @Test
    void give_empty_text_when_only_qualifiers_are_given() {
        assertThat(SearchQuery.parse("type:flow").text(), is(""));
    }

    @ParameterizedTest
    @CsvSource({
            "architecture, architectures",
            "architectures, architectures",
            "pattern, patterns",
            "flows, flows",
            "standard, standards",
            "interface, interfaces",
            "control, controls",
            "adrs, adrs"
    })
    void map_singular_and_plural_types_to_a_group(String type, String group) {
        SearchQuery query = SearchQuery.parse("type:" + type);

        assertThat(query.group(), is(Optional.of(group)));
        assertThat(query.hasUnknownType(), is(false));
    }

    @Test
    void report_an_unknown_type() {
        SearchQuery query = SearchQuery.parse("type:decorator");

        assertThat(query.group(), is(Optional.empty()));
        assertThat(query.hasUnknownType(), is(true));
    }

    @Test
    void keep_readable_namespaces_when_there_is_no_namespace_qualifier() {
        Optional<Set<String>> readable = Optional.of(Set.of("finos"));

        assertThat(SearchQuery.parse("x").narrowNamespaces(readable), is(readable));
        assertThat(SearchQuery.parse("x").narrowDomains(readable), is(readable));
    }

    @Test
    void narrow_to_the_namespace_qualifier_when_all_namespaces_are_readable() {
        assertThat(SearchQuery.parse("ns:finos").narrowNamespaces(Optional.empty()), is(Optional.of(Set.of("finos"))));
    }

    @Test
    void give_no_namespaces_when_the_namespace_qualifier_is_not_readable() {
        Optional<Set<String>> narrowed = SearchQuery.parse("ns:secret").narrowNamespaces(Optional.of(Set.of("finos")));

        assertThat(narrowed.orElseThrow(), is(empty()));
    }

    @Test
    void exclude_controls_when_a_namespace_qualifier_is_given() {
        assertThat(SearchQuery.parse("ns:finos").narrowDomains(Optional.empty()).orElseThrow(), is(empty()));
    }

    @Test
    void keep_all_groups_without_a_type_qualifier() {
        GroupedSearchResults results = allGroups();

        assertThat(SearchQuery.parse("x").filterTypes(results), is(results));
    }

    @Test
    void keep_only_the_group_of_the_type_qualifier() {
        GroupedSearchResults filtered = SearchQuery.parse("type:control").filterTypes(allGroups());

        assertThat(filtered.getControls(), equalTo(List.of(RESULT)));
        assertThat(filtered.getArchitectures(), is(empty()));
        assertThat(filtered.getPatterns(), is(empty()));
        assertThat(filtered.getFlows(), is(empty()));
        assertThat(filtered.getStandards(), is(empty()));
        assertThat(filtered.getInterfaces(), is(empty()));
        assertThat(filtered.getAdrs(), is(empty()));
    }

    @ParameterizedTest
    @CsvSource({"architecture", "pattern", "flow", "standard", "interface", "adr"})
    void keep_each_type_group(String type) {
        GroupedSearchResults filtered = SearchQuery.parse("type:" + type).filterTypes(allGroups());

        long nonEmpty = List.of(filtered.getArchitectures(), filtered.getPatterns(), filtered.getFlows(),
                filtered.getStandards(), filtered.getInterfaces(), filtered.getControls(), filtered.getAdrs())
                .stream().filter(l -> !l.isEmpty()).count();
        assertThat(nonEmpty, is(1L));
    }

    private static GroupedSearchResults allGroups() {
        List<SearchResult> one = List.of(RESULT);
        return new GroupedSearchResults(one, one, one, one, one, one, one);
    }
}
