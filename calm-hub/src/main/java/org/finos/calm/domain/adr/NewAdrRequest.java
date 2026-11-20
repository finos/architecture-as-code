package org.finos.calm.domain.adr;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import org.owasp.html.PolicyFactory;
import org.owasp.html.Sanitizers;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

public final class NewAdrRequest {

    @JsonIgnore
    public static final PolicyFactory SANITIZATION_POLICY = Sanitizers.FORMATTING.and(Sanitizers.BLOCKS).and(Sanitizers.TABLES);
    private String slug;
    private String title;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @JsonDeserialize(using = LocalDateDeserializer.class)
    @JsonSerialize(using = LocalDateSerializer.class)
    private LocalDate decisionDate;
    private List<String> requesters;
    private List<String> approvers;
    private String contextAndProblemStatement;
    private List<String> decisionDrivers;
    private List<Option> consideredOptions;
    private Decision decisionOutcome;
    private List<Link> links;

    public NewAdrRequest() {

    }

    public NewAdrRequest(
            String title,
            String contextAndProblemStatement,
            List<String> decisionDrivers,
            List<Option> consideredOptions,
            Decision decisionOutcome,
            List<Link> links
    ) {
        setTitle(title);
        setContextAndProblemStatement(contextAndProblemStatement);
        setDecisionDrivers(decisionDrivers);
        this.consideredOptions = consideredOptions;
        this.decisionOutcome = decisionOutcome;
        this.links = links;
    }

    /**
     * The slug the caller asks for. Optional: when absent or not a valid slug, the store
     * derives one from the title.
     */
    public String getSlug() {
        return slug;
    }

    public String getTitle() {
        return title;
    }

    public LocalDate getDecisionDate() {
        return decisionDate;
    }

    public List<String> getRequesters() {
        return requesters;
    }

    public List<String> getApprovers() {
        return approvers;
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

    public void setSlug(String slug) {
        this.slug = (slug == null) ? null : SANITIZATION_POLICY.sanitize(slug);
    }

    public void setTitle(String title) {
        this.title = (title == null) ? null : SANITIZATION_POLICY.sanitize(title);
    }

    public void setDecisionDate(LocalDate decisionDate) {
        this.decisionDate = decisionDate;
    }

    public void setRequesters(List<String> requesters) {
        this.requesters = sanitizeAll(requesters);
    }

    public void setApprovers(List<String> approvers) {
        this.approvers = sanitizeAll(approvers);
    }

    public void setContextAndProblemStatement(String contextAndProblemStatement) {
        this.contextAndProblemStatement =
                (contextAndProblemStatement == null) ? null : SANITIZATION_POLICY.sanitize(contextAndProblemStatement);
    }

    public void setDecisionDrivers(List<String> decisionDrivers) {
        this.decisionDrivers = sanitizeAll(decisionDrivers);
    }

    public void setConsideredOptions(List<Option> consideredOptions) {
        this.consideredOptions = consideredOptions;
    }

    public void setDecisionOutcome(Decision decisionOutcome) {
        this.decisionOutcome = decisionOutcome;
    }

    public void setLinks(List<Link> links) {
        this.links = links;
    }

    private List<String> sanitizeAll(List<String> values) {
        return (values == null) ? null : values.stream().map(SANITIZATION_POLICY::sanitize).toList();
    }

    @Override
    public boolean equals(Object o) {
        if(this == o) return true;
        if(o == null || getClass() != o.getClass()) return false;
        NewAdrRequest that = (NewAdrRequest) o;
        return Objects.equals(slug, that.slug) && Objects.equals(title, that.title)
                && Objects.equals(decisionDate, that.decisionDate) && Objects.equals(requesters, that.requesters)
                && Objects.equals(approvers, that.approvers)
                && Objects.equals(contextAndProblemStatement, that.contextAndProblemStatement)
                && Objects.equals(decisionDrivers, that.decisionDrivers)
                && Objects.equals(consideredOptions, that.consideredOptions)
                && Objects.equals(decisionOutcome, that.decisionOutcome) && Objects.equals(links, that.links);
    }

    @Override
    public int hashCode() {
        return Objects.hash(slug, title, decisionDate, requesters, approvers, contextAndProblemStatement,
                decisionDrivers, consideredOptions, decisionOutcome, links);
    }


}
