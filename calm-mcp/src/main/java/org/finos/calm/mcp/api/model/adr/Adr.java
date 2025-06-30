package org.finos.calm.mcp.api.model.adr;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

public class Adr {
    private String title;
    private Status status;
    @JsonDeserialize(using = LocalDateTimeDeserializer.class)
    @JsonSerialize(using = LocalDateTimeSerializer.class)
    private LocalDateTime creationDateTime;
    @JsonDeserialize(using = LocalDateTimeDeserializer.class)
    @JsonSerialize(using = LocalDateTimeSerializer.class)
    private LocalDateTime updateDateTime;
    private String contextAndProblemStatement;
    private List<String> decisionDrivers;
    private List<Option> consideredOptions;
    private Decision decisionOutcome;
    private List<Link> links;

    public Adr() {

    }

    public Adr(
            String title,
            Status status,
            @JsonDeserialize(using = LocalDateTimeDeserializer.class)
            @JsonSerialize(using = LocalDateTimeSerializer.class)
            LocalDateTime creationDateTime,
            @JsonDeserialize(using = LocalDateTimeDeserializer.class)
            @JsonSerialize(using = LocalDateTimeSerializer.class)
            LocalDateTime updateDateTime,
            String contextAndProblemStatement,
            List<String> decisionDrivers,
            List<Option> consideredOptions,
            Decision decisionOutcome,
            List<Link> links

    ) {
        this.title = title;
        this.status = status;
        this.creationDateTime = creationDateTime;
        this.updateDateTime = updateDateTime;
        this.contextAndProblemStatement = contextAndProblemStatement;
        this.decisionDrivers = decisionDrivers;
        this.consideredOptions = consideredOptions;
        this.decisionOutcome = decisionOutcome;
        this.links = links;
    }

    public String getTitle() {
        return title;
    }

    public Status getStatus() {
        return status;
    }

    public LocalDateTime getCreationDateTime() {
        return creationDateTime;
    }

    public LocalDateTime getUpdateDateTime() {
        return updateDateTime;
    }

    public String getContextAndProblemStatement() {
        return contextAndProblemStatement;
    }

    public List<String> getDecisionDrivers() {
        return decisionDrivers;
    }

    public List<Option> getConsideredOptions() {
        return consideredOptions;
    }

    public Decision getDecisionOutcome() {
        return decisionOutcome;
    }

    public List<Link> getLinks() {
        return links;
    }

    // does not include datetimes in equals
    @Override
    public boolean equals(Object o) {
        if(this == o) return true;
        if(o == null || getClass() != o.getClass()) return false;
        Adr that = (Adr) o;
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

    @Override
    public String toString() {
        return "Adr[" +
                "title=" + title + ", " +
                "status=" + status + ", " +
                "creationDateTime=" + creationDateTime + ", " +
                "updateDateTime=" + updateDateTime + ", " +
                "contextAndProblemStatement=" + contextAndProblemStatement + ", " +
                "decisionDrivers=" + decisionDrivers + ", " +
                "consideredOptions=" + consideredOptions + ", " +
                "decisionOutcome=" + decisionOutcome + ", " +
                "links=" + links + ']';
    }

    public static class AdrBuilder {
        private String title;
        private Status status;
        private LocalDateTime creationDateTime;
        private LocalDateTime updateDateTime;
        private String contextAndProblemStatement;
        private List<String> decisionDrivers;
        private List<Option> consideredOptions;
        private Decision decisionOutcome;
        private List<Link> links;

        public AdrBuilder() {

        }

        public AdrBuilder(Adr adr) {
            this.title = adr.getTitle();
            this.status = adr.getStatus();
            this.creationDateTime = adr.getCreationDateTime();
            this.updateDateTime = adr.getUpdateDateTime();
            this.contextAndProblemStatement = adr.getContextAndProblemStatement();
            this.decisionDrivers = adr.getDecisionDrivers();
            this.consideredOptions = adr.getConsideredOptions();
            this.decisionOutcome = adr.getDecisionOutcome();
            this.links = adr.getLinks();
        }

        public AdrBuilder(NewAdrRequest newAdrRequest) {
            this.title = newAdrRequest.getTitle();
            this.contextAndProblemStatement = newAdrRequest.getContextAndProblemStatement();
            this.decisionDrivers = newAdrRequest.getDecisionDrivers();
            this.consideredOptions = newAdrRequest.getConsideredOptions();
            this.decisionOutcome = newAdrRequest.getDecisionOutcome();
            this.links = newAdrRequest.getLinks();
        }

        public AdrBuilder setTitle(String title) {
            this.title = title;
            return this;
        }

        public AdrBuilder setStatus(Status status) {
            this.status = status;
            return this;
        }

        public AdrBuilder setCreationDateTime(LocalDateTime creationDateTime) {
            this.creationDateTime = creationDateTime;
            return this;
        }

        public AdrBuilder setUpdateDateTime(LocalDateTime updateDateTime) {
            this.updateDateTime = updateDateTime;
            return this;
        }

        public AdrBuilder setContextAndProblemStatement(String contextAndProblemStatement) {
            this.contextAndProblemStatement = contextAndProblemStatement;
            return this;
        }

        public AdrBuilder setDecisionDrivers(List<String> decisionDrivers) {
            this.decisionDrivers = decisionDrivers;
            return this;
        }

        public AdrBuilder setConsideredOptions(List<Option> consideredOptions) {
            this.consideredOptions = consideredOptions;
            return this;
        }

        public AdrBuilder setDecisionOutcome(Decision decisionOutcome) {
            this.decisionOutcome = decisionOutcome;
            return this;
        }

        public AdrBuilder setLinks(List<Link> links) {
            this.links = links;
            return this;
        }

        public Adr build() {
            return new Adr(title, status, creationDateTime, updateDateTime, contextAndProblemStatement, decisionDrivers, consideredOptions, decisionOutcome, links);
        }
    }

}
