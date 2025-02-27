package org.finos.calm.sanitizer;

import jakarta.enterprise.context.ApplicationScoped;
import org.finos.calm.domain.adr.Decision;
import org.finos.calm.domain.adr.Link;
import org.finos.calm.domain.adr.NewAdrRequest;
import org.finos.calm.domain.adr.Option;
import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;

@ApplicationScoped
public class AdrSanitizer {

    //strict policy that strips all HTML elements
    private final PolicyFactory strictPolicy = new HtmlPolicyBuilder().toFactory();

    public NewAdrRequest sanitizeNewAdrRequest(NewAdrRequest newAdrRequest) {
        return new NewAdrRequest(
                newAdrRequest.title() == null ? null : strictPolicy.sanitize(newAdrRequest.title()),
                newAdrRequest.contextAndProblemStatement() == null ? null : strictPolicy.sanitize(newAdrRequest.contextAndProblemStatement()),
                newAdrRequest.decisionDrivers() == null ? null : newAdrRequest.decisionDrivers().stream().map(strictPolicy::sanitize).toList(),
                newAdrRequest.consideredOptions() == null ? null : newAdrRequest.consideredOptions().stream().map(this::sanitizeOption).toList(),
                newAdrRequest.decisionOutcome() == null ? null : sanitizeDecision(newAdrRequest.decisionOutcome()),
                newAdrRequest.links() == null ? null : newAdrRequest.links().stream().map(this::sanitizeLink).toList()
        );
    }

    private Option sanitizeOption(Option option) {
        return new Option(
                option.name() == null ? null : strictPolicy.sanitize(option.name()),
                option.description() == null ? null : strictPolicy.sanitize(option.description()),
                option.positiveConsequences() == null ? null : option.positiveConsequences().stream().map(strictPolicy::sanitize).toList(),
                option.negativeConsequences() == null ? null : option.negativeConsequences().stream().map(strictPolicy::sanitize).toList()
        );
    }

    private Decision sanitizeDecision(Decision decision) {
        return new Decision(
                decision.chosenOption() == null ? null : sanitizeOption(decision.chosenOption()),
                decision.rationale() == null ? null : strictPolicy.sanitize(decision.rationale())
        );
    }

    private Link sanitizeLink(Link link) {
        return new Link(
                link.rel() == null ? null : strictPolicy.sanitize(link.rel()),
                link.href() == null ? null : strictPolicy.sanitize(link.href())
        );
    }
}
