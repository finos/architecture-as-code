package org.finos.calm.store.util;

import org.dizitart.no2.collection.Document;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class TypeSafeNitriteDocument<T> {
    private final Document document;
    private final Class<T> type;

    public TypeSafeNitriteDocument(Document document, Class<T> type) {
        this.document = document;
        this.type = type;
    }

    public List<T> getList(String key) {
        if (document == null) return null;

        List<?> rawList = document.get(key, List.class);
        List<T> typedList = new ArrayList<>();
        if (rawList != null) {
            for (Object o : rawList) {
                if (type.isInstance(o)) {
                    typedList.add(type.cast(o));
                }
            }
        }
        return typedList;
    }

    public Map<String, T> getMap(String key) {
        if (document == null) return null;

        Map<?, ?> rawMap = document.get(key, Map.class);
        Map<String, T> typedMap = new HashMap<>();
        if (rawMap != null) {
            for (Map.Entry<?, ?> entry : rawMap.entrySet()) {
                if (type.isInstance(entry.getValue())) {
                    typedMap.put((String) entry.getKey(), type.cast(entry.getValue()));
                }
            }
        }
        return typedMap;
    }
}
