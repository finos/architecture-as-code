package org.finos.calm.domain.adr;

import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

import static org.hamcrest.Matchers.hasToString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

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
    
    @Test
    void handle_null_values() {
        Link link = new Link(null, null);
        assertNull(link.getRel());
        assertNull(link.getHref());
        
        // Test setting null values
        Link link2 = new Link("rel", "href");
        link2.setRel(null);
        link2.setHref(null);
        assertNull(link2.getRel());
        assertNull(link2.getHref());
    }
    
    @Test
    void test_equals_and_hashcode() {
        Link link1 = new Link("rel1", "href1");
        Link link2 = new Link("rel1", "href1");
        Link link3 = new Link("rel2", "href1");
        Link link4 = new Link("rel1", "href2");
        
        // Test equals
        assertEquals(link1, link1); // Same object
        assertEquals(link1, link2); // Equal objects
        assertNotEquals(link1, link3); // Different rel
        assertNotEquals(link1, link4); // Different href
        assertNotEquals(link1, null); // Null comparison
        assertNotEquals(link1, new Object()); // Different class
        
        // Test hashCode
        assertEquals(link1.hashCode(), link2.hashCode()); // Equal objects have equal hashcodes
        assertNotEquals(link1.hashCode(), link3.hashCode()); // Different objects likely have different hashcodes
    }
    
    @Test
    void test_toString() {
        Link link = new Link("rel1", "href1");
        String expectedString = "Link{rel='rel1', href='href1'}";
        assertThat(link, hasToString(expectedString));
    }
}