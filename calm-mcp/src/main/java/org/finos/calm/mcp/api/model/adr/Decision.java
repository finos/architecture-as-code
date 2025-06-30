package org.finos.calm.mcp.api.model.adr;

import com.fasterxml.jackson.annotation.JsonIgnore;
import org.owasp.html.PolicyFactory;
import org.owasp.html.Sanitizers;

import java.util.Objects;

public final class Decision {

    @JsonIgnore
    private final PolicyFactory DECISION_POLICY = Sanitizers.FORMATTING.and(Sanitizers.BLOCKS).and(Sanitizers.TABLES);
    private Option chosenOption;
    private String rationale;

    public Decision() {

    }

    public Decision(Option chosenOption, String rationale) {
        setRationale(rationale);
        this.chosenOption = chosenOption;
    }

    public Option getChosenOption() {
        return chosenOption;
    }

    public String getRationale() {
        return rationale;
    }

    public void setChosenOption(Option chosenOption) {
        this.chosenOption = chosenOption;
    }

    public void setRationale(String rationale) {
        this.rationale = (rationale == null) ? null : DECISION_POLICY.sanitize(rationale);
    }

    @Override
    public boolean equals(Object obj) {
        if(obj == this) return true;
        if(obj == null || obj.getClass() != this.getClass()) return false;
        var that = (Decision) obj;
        return Objects.equals(this.chosenOption, that.chosenOption) &&
                Objects.equals(this.rationale, that.rationale);
    }

    @Override
    public int hashCode() {
        return Objects.hash(chosenOption, rationale);
    }

}
