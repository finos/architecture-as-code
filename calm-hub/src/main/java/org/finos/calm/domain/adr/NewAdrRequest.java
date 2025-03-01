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
        if(title == null) {
            this.title = null;
        } else {
            this.title = NEW_ADR_REQUEST_POLICY.sanitize(title);
        }
    }

    public void setContextAndProblemStatement(String contextAndProblemStatement) {
        if(contextAndProblemStatement == null) {
            this.contextAndProblemStatement = null;
        } else {
            this.contextAndProblemStatement = NEW_ADR_REQUEST_POLICY.sanitize(contextAndProblemStatement);
        }
    }

    public void setDecisionDrivers(List<String> decisionDrivers) {
        if(decisionDrivers == null) {
            this.decisionDrivers = null;
        } else {
            this.decisionDrivers = decisionDrivers.stream().map(NEW_ADR_REQUEST_POLICY::sanitize).toList();
        }
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

}
