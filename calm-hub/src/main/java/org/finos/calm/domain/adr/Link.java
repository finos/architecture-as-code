package org.finos.calm.domain.adr;

import com.fasterxml.jackson.annotation.JsonIgnore;
import org.owasp.html.PolicyFactory;
import org.owasp.html.Sanitizers;

import java.util.Objects;

public final class Link {

    @JsonIgnore
    private final PolicyFactory LINK_POLICY = Sanitizers.FORMATTING.and(Sanitizers.BLOCKS).and(Sanitizers.TABLES);

    private String rel;
    private String href;

    public Link() {

    }

    public Link(String rel, String href) {
        setRel(rel);
        setHref(href);
    }

    public String getRel() {
        return rel;
    }

    public String getHref() {
        return href;
    }

    public void setRel(String rel) {
        this.rel = (rel == null) ? null : LINK_POLICY.sanitize(rel);
    }

    public void setHref(String href) {
        this.href = (href == null) ? null : LINK_POLICY.sanitize(href);
    }

    @Override
    public boolean equals(Object obj) {
        if(obj == this) return true;
        if(obj == null || obj.getClass() != this.getClass()) return false;
        var that = (Link) obj;
        return Objects.equals(this.rel, that.rel) &&
                Objects.equals(this.href, that.href);
    }

    @Override
    public int hashCode() {
        return Objects.hash(rel, href);
    }

    @Override
    public String toString() {
        return "Link{" +
                "rel='" + rel + '\'' +
                ", href='" + href + '\'' +
                '}';
    }
}
