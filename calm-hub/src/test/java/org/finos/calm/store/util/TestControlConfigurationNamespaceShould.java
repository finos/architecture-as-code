package org.finos.calm.store.util;

import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;

class TestControlConfigurationNamespaceShould {

    @Test
    void combine_the_domain_and_control_id_with_a_double_colon() {
        assertThat(ControlConfigurationNamespace.of("security", 1), is("security::1"));
    }

    @Test
    void produce_distinct_values_for_different_controls_in_the_same_domain() {
        assertThat(ControlConfigurationNamespace.of("security", 1),
                is(not(ControlConfigurationNamespace.of("security", 2))));
    }
}
