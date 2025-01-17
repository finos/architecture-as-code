package org.finos.calm.domain.adr;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import io.soabase.recordbuilder.core.RecordBuilder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@RecordBuilder.Options(enableWither = false)
@RecordBuilder
public record AdrContent(
        String title,
        AdrStatus status,
        @JsonDeserialize(using = LocalDateTimeDeserializer.class)
        @JsonSerialize(using = LocalDateTimeSerializer.class)
        LocalDateTime creationDateTime,
        @JsonDeserialize(using = LocalDateTimeDeserializer.class)
        @JsonSerialize(using = LocalDateTimeSerializer.class)
        LocalDateTime updateDateTime,
        String contextAndProblemStatement,
        List<String> decisionDrivers,
        List<AdrOption> consideredOptions,
        AdrDecision decisionOutcome,
        List<AdrLink> links

) {

    public static AdrContentBuilder builderFromNewAdr(NewAdr newAdr) {
        return AdrContentBuilder.builder()
                .title(newAdr.title())
                .contextAndProblemStatement(newAdr.contextAndProblemStatement())
                .decisionDrivers(newAdr.decisionDrivers())
                .consideredOptions(newAdr.consideredOptions())
                .decisionOutcome(newAdr.decisionOutcome())
                .links(newAdr.links());
    }

    // does not include datetimes in equals
    @Override
    public boolean equals(Object o) {
        if(this == o) return true;
        if(o == null || getClass() != o.getClass()) return false;
        AdrContent that = (AdrContent) o;
        return Objects.equals(title, that.title) &&
                status == that.status &&
                Objects.equals(contextAndProblemStatement, that.contextAndProblemStatement) &&
                Objects.equals(decisionDrivers, that.decisionDrivers) &&
                Objects.equals(consideredOptions, that.consideredOptions) &&
                Objects.equals(decisionOutcome, that.decisionOutcome) &&
                Objects.equals(links, that.links);
    }

    @Override
    public int hashCode() {
        return Objects.hash(title, status, contextAndProblemStatement, decisionDrivers, consideredOptions, decisionOutcome, links);
    }
}
