package org.finos.calm.domain.search;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A search query with optional qualifiers, e.g. {@code namespace:finos type:pattern trading}.
 * A space after the colon is allowed. The remaining text is the free-text term; it may be empty
 * when a qualifier is given, which then lists everything the qualifiers allow.
 */
public record SearchQuery(String text, Optional<String> namespace, Optional<String> type) {

    // Bounded by the 200-character query limit, and linear: no nested quantifiers.
    private static final Pattern QUALIFIER =
            Pattern.compile("(?i)\\b(namespace|ns|type):\\s*([A-Za-z0-9._-]+)");

    private static final Map<String, String> TYPE_ALIASES = Map.ofEntries(
            Map.entry("architecture", "architectures"),
            Map.entry("pattern", "patterns"),
            Map.entry("flow", "flows"),
            Map.entry("standard", "standards"),
            Map.entry("interface", "interfaces"),
            Map.entry("control", "controls"),
            Map.entry("adr", "adrs")
    );

    public static final List<String> TYPES = List.of(
            "architecture", "pattern", "flow", "standard", "interface", "control", "adr");

    public static SearchQuery parse(String raw) {
        String namespace = null;
        String type = null;
        Matcher matcher = QUALIFIER.matcher(raw);
        StringBuilder text = new StringBuilder();
        while (matcher.find()) {
            String key = matcher.group(1).toLowerCase(Locale.ROOT);
            String value = matcher.group(2);
            if (key.equals("type")) {
                type = value.toLowerCase(Locale.ROOT);
            } else {
                namespace = value;
            }
            matcher.appendReplacement(text, " ");
        }
        matcher.appendTail(text);
        return new SearchQuery(text.toString().trim().replaceAll("\\s+", " "),
                Optional.ofNullable(namespace), Optional.ofNullable(type));
    }

    /** The result group for the type qualifier, or empty when the type is unknown. */
    public Optional<String> group() {
        return type.map(t -> t.endsWith("s") ? t.substring(0, t.length() - 1) : t).map(TYPE_ALIASES::get);
    }

    public boolean hasUnknownType() {
        return type.isPresent() && group().isEmpty();
    }

    /**
     * Narrows the caller's readable namespaces to the namespace qualifier, so the store filters
     * before its per-type cap.
     */
    public Optional<Set<String>> narrowNamespaces(Optional<Set<String>> readable) {
        if (namespace.isEmpty()) {
            return readable;
        }
        Set<String> narrowed = new HashSet<>(Set.of(namespace.get()));
        readable.ifPresent(narrowed::retainAll);
        return Optional.of(narrowed);
    }

    /** Controls belong to a domain, not a namespace, so a namespace qualifier excludes them. */
    public Optional<Set<String>> narrowDomains(Optional<Set<String>> readable) {
        return namespace.isPresent() ? Optional.of(Collections.emptySet()) : readable;
    }

    public GroupedSearchResults filterTypes(GroupedSearchResults results) {
        Optional<String> group = group();
        if (group.isEmpty()) {
            return results;
        }
        String g = group.get();
        return new GroupedSearchResults(
                g.equals("architectures") ? results.getArchitectures() : List.of(),
                g.equals("patterns") ? results.getPatterns() : List.of(),
                g.equals("flows") ? results.getFlows() : List.of(),
                g.equals("standards") ? results.getStandards() : List.of(),
                g.equals("interfaces") ? results.getInterfaces() : List.of(),
                g.equals("controls") ? results.getControls() : List.of(),
                g.equals("adrs") ? results.getAdrs() : List.of());
    }
}
