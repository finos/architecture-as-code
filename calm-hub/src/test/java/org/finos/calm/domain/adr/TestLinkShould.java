package org.finos.calm.domain.adr;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TestLinkShould {

    @Test
    void construct_sanitized_link() {
        Link unsafelyConstructedLink = new Link("<i>My Link</i><img><script>", "http://blah<script>hidden-script</script>");
        Link expectedLink = new Link("<i>My Link</i>", "http://blah");
        assertEquals(expectedLink, unsafelyConstructedLink);
    }

    @Test
    void sanitize_rel_on_set() {
        Link link = new Link();
        link.setRel("<i>My Link</i><img><script>");
        assertEquals("<i>My Link</i>", link.getRel());
    }

    @Test
    void sanitize_href_on_set() {
        Link link = new Link();
        link.setHref("http://blah<script>hidden-script</script>");
        assertEquals("http://blah", link.getHref());
    }

}