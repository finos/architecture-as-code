package org.finos.calm.domain.adr;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TestOptionShould {

    @Test
    void construct_sanitized_option() {
        Option unsafelyConstructedOption = new Option(
                "<h1><b><i>My Name</i></b></h1><script>",
                "this is an option<img><a>",
                List.of("blahblah<script>"),
                List.of("blahblah<script>")
        );
        Option expectedOption = new Option(
                "<h1><b><i>My Name</i></b></h1>",
                "this is an option",
                List.of("blahblah"),
                List.of("blahblah")
        );
        assertEquals(expectedOption, unsafelyConstructedOption);
    }

    @Test
    void sanitize_name_on_set() {
        Option option = new Option();
        option.setName("<h1><b><i>My Name</i></b></h1><script>");
        assertEquals("<h1><b><i>My Name</i></b></h1>", option.getName());
    }

    @Test
    void sanitize_description_on_set() {
        Option option = new Option();
        option.setDescription("this is an option<img><a>");
        assertEquals("this is an option", option.getDescription());
    }

    @Test
    void sanitize_positive_consequences_on_set() {
        Option option = new Option();
        option.setPositiveConsequences(List.of("blahblah<script>"));
        assertEquals(List.of("blahblah"), option.getPositiveConsequences());
    }

    @Test
    void sanitize_negative_consequences_on_set() {
        Option option = new Option();
        option.setNegativeConsequences(List.of("blahblah<script>"));
        assertEquals(List.of("blahblah"), option.getNegativeConsequences());
    }

}