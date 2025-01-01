package org.finos.calm.domain;

import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

public class TestPattern {

    private static final String VERSION = "1.0.0";

    @Test
    void pattern_should_return_built_values() {
        int expectedId = 1;
        String expectedPatternJson = "{\"test\":\"test\"}";
        String expectedVersion = VERSION;
        String expectedNamespace = "finos";

        Pattern pattern = new Pattern.PatternBuilder()
                .setId(expectedId)
                .setPattern(expectedPatternJson)
                .setVersion(expectedVersion)
                .setNamespace(expectedNamespace)
                .build();

        assertThat(pattern.getId(), equalTo(expectedId));
        assertThat(pattern.getPatternJson(), equalTo(expectedPatternJson));
        assertThat(pattern.getDotVersion(), equalTo(expectedVersion));
        assertThat(pattern.getNamespace(), equalTo(expectedNamespace));
    }

    @Test
    void pattern_versions_replaced_with_dash_for_mongo_persist() {
        Pattern pattern = new Pattern.PatternBuilder().setVersion(VERSION).build();
        assertThat(pattern.getMongoVersion(), equalTo("1-0-0"));
    }

    @Test
    void pattern_with_no_versions_not_impacted_by_replacement() {
        String expectedVersion = "1";
        Pattern pattern = new Pattern.PatternBuilder().setVersion(expectedVersion).build();
        assertThat(pattern.getMongoVersion(), equalTo(expectedVersion));
    }
}
