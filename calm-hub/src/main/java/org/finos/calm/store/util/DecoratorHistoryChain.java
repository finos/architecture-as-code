package org.finos.calm.store.util;

import org.finos.calm.domain.DecoratorHistoryEntry;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Follows the {@code supersedes} links between stored decorators.
 */
public final class DecoratorHistoryChain {

    private DecoratorHistoryChain() {
    }

    /**
     * @return the history that contains {@code id}: the current decorator first, then each one it
     * supersedes. Empty if no entry has {@code id}.
     */
    public static List<DecoratorHistoryEntry> of(List<DecoratorHistoryEntry> entries, int id) {
        Map<Integer, DecoratorHistoryEntry> byId = entries.stream()
                .collect(Collectors.toMap(DecoratorHistoryEntry::getId, Function.identity(), (first, second) -> first));
        DecoratorHistoryEntry entry = byId.get(id);
        if (entry == null) {
            return List.of();
        }

        // The visited sets guard against a cycle in damaged data.
        Set<Integer> visited = new HashSet<>(Set.of(id));
        while (entry.getSupersededBy() != null && byId.containsKey(entry.getSupersededBy())
                && visited.add(entry.getSupersededBy())) {
            entry = byId.get(entry.getSupersededBy());
        }

        List<DecoratorHistoryEntry> history = new ArrayList<>();
        visited.clear();
        while (entry != null && visited.add(entry.getId())) {
            history.add(entry);
            entry = entry.getSupersedes() == null ? null : byId.get(entry.getSupersedes());
        }
        return history;
    }
}
