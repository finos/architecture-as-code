package org.finos.calm.domain;

import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

public class TestPattern {

    private static final String VERSION = "1.0.0";

    @Test
    void pattern_should_return_built_values() {
        int expectedId = 1;
        String expectedName = "pattern-name";
        String expectedDescription = "pattern description";
        String expectedPatternJson = "{\"test\":\"test\"}";
        String expectedVersion = VERSION;
        String expectedNamespace = "finos";

        Pattern pattern = new Pattern();
        pattern.setId(expectedId)
        pattern.setName(expectedName);
        pattern.setDescription(expectedDescription);
        pattern.setPatternJson(expectedPatternJson);
        pattern.setVersion(expectedVersion);
        pattern.setNamespace(expectedNamespace);

        assertThat(pattern.getId(), equalTo(expectedId));
        assertThat(pattern.getName(), equalTo(expectedName));
        assertThat(pattern.getDescription(), equalTo(expectedDescription));
        assertThat(pattern.getPatternJson(), equalTo(expectedPatternJson));
        assertThat(pattern.getVersion(), equalTo(expectedVersion));
        assertThat(pattern.getNamespace(), equalTo(expectedNamespace));
    }

    @Test
    void pattern_with_no_versions_not_impacted_by_replacement() {
        String expectedVersion = "1";
        Pattern pattern = new Pattern();
        pattern.setVersion(expectedVersion);
        assertThat(pattern.getVersion(), equalTo(expectedVersion));
    }
}
