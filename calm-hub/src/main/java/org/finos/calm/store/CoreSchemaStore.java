package org.finos.calm.store;

import java.util.List;
import java.util.Map;

public interface CoreSchemaStore {
    List<String> getVersions();
    Map<String, Object> getSchemasForVersion(String version);
}
