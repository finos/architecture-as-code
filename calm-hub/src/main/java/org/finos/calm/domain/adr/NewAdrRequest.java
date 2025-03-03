package org.finos.calm.domain.adr;

import com.fasterxml.jackson.annotation.JsonIgnore;
import org.owasp.html.PolicyFactory;
import org.owasp.html.Sanitizers;

import java.util.List;
import java.util.Objects;

public final class NewAdrRequest {

    @JsonIgnore
    private final PolicyFactory NEW_ADR_REQUEST_POLICY = Sanitizers.FORMATTING.and(Sanitizers.BLOCKS).and(Sanitizers.TABLES);
    private String title;
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
        setConsideredOptions(consideredOptions);
        setDecisionOutcome(decisionOutcome);
        setLinks(links);
    }

    public String getTitle() {
        return title;
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

    public void setTitle(String title) {
        this.title = (title == null) ? null : NEW_ADR_REQUEST_POLICY.sanitize(title);
    }

    public void setContextAndProblemStatement(String contextAndProblemStatement) {
        this.contextAndProblemStatement =
                (contextAndProblemStatement == null) ? null : NEW_ADR_REQUEST_POLICY.sanitize(contextAndProblemStatement);
    }

    public void setDecisionDrivers(List<String> decisionDrivers) {
        this.decisionDrivers =
                (decisionDrivers == null) ? null : decisionDrivers.stream().map(NEW_ADR_REQUEST_POLICY::sanitize).toList();

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

    @Override
    public boolean equals(Object o) {
        if(this == o) return true;
        if(o == null || getClass() != o.getClass()) return false;
        NewAdrRequest that = (NewAdrRequest) o;
        return Objects.equals(title, that.title) && Objects.equals(contextAndProblemStatement, that.contextAndProblemStatement) && Objects.equals(decisionDrivers, that.decisionDrivers) && Objects.equals(consideredOptions, that.consideredOptions) && Objects.equals(decisionOutcome, that.decisionOutcome) && Objects.equals(links, that.links);
    }

    @Override
    public int hashCode() {
        return Objects.hash(title, contextAndProblemStatement, decisionDrivers, consideredOptions, decisionOutcome, links);
    }


}
