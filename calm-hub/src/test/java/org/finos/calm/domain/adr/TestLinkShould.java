package org.finos.calm.domain.adr;

import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

class TestLinkShould {

    @Test
    void construct_sanitized_link() {
        Link unsafelyConstructedLink = new Link("<i>My Link</i><img><script>", "http://blah<script>hidden-script</script>");
        Link expectedLink = new Link("<i>My Link</i>", "http://blah");
        assertThat(unsafelyConstructedLink, is(expectedLink));
    }

    @Test
    void sanitize_rel_on_set() {
        Link link = new Link();
        link.setRel("<i>My Link</i><img><script>");
        assertThat(link.getRel(), is("<i>My Link</i>"));
    }

    @Test
    void sanitize_href_on_set() {
        Link link = new Link();
        link.setHref("http://blah<script>hidden-script</script>");
        assertThat(link.getHref(), is("http://blah"));
    }

}