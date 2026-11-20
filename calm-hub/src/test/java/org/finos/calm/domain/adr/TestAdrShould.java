package org.finos.calm.domain.adr;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;

class TestAdrShould {

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Test
    void read_a_stored_adr_that_predates_the_new_fields() throws Exception {
        String stored = """
                {"title":"Old","status":"accepted","creationDateTime":[2024,1,2,3,4,5],
                 "updateDateTime":null,"contextAndProblemStatement":"ctx","decisionDrivers":null,
                 "consideredOptions":null,"decisionOutcome":null,"links":null}
                """;

        Adr adr = objectMapper.readValue(stored, Adr.class);

        assertThat(adr.getTitle(), is("Old"));
        assertThat(adr.getDecisionDate(), is(nullValue()));
        assertThat(adr.getRequesters(), is(nullValue()));
        assertThat(adr.getApprovers(), is(nullValue()));
        // Written back, it still has no trace of the fields it never had.
        String written = objectMapper.writeValueAsString(adr);
        assertThat(written, not(containsString("decisionDate")));
        assertThat(written, not(containsString("requesters")));
        assertThat(objectMapper.readValue(written, Adr.class), is(adr));
    }

    @Test
    void round_trip_the_new_fields_with_an_iso_decision_date() throws Exception {
        Adr adr = new Adr.AdrBuilder()
                .setTitle("New")
                .setStatus(Status.draft)
                .setCreationDateTime(LocalDateTime.of(2024, 1, 2, 3, 4))
                .setDecisionDate(LocalDate.of(2024, 5, 1))
                .setRequesters(List.of("alice"))
                .setApprovers(List.of("bob"))
                .build();

        String written = objectMapper.writeValueAsString(adr);
        Adr read = objectMapper.readValue(written, Adr.class);

        assertThat(written, containsString("\"decisionDate\":\"2024-05-01\""));
        assertThat(read, is(adr));
        assertThat(read.hashCode(), is(adr.hashCode()));
        assertThat(new Adr.AdrBuilder(read).build(), is(adr));
        assertThat(adr.toString(), containsString("decisionDate=2024-05-01"));
    }
}
