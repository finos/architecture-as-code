package org.finos.calm.resources;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.owasp.html.PolicyFactory;

public class TestSanitizationSecurityShould {

    @Test
    void withstand_noscript_style_injection_attack() {
        // This test verifies the fix for the specific vulnerability where allowTextIn("style") 
        // combined with noscript tags could lead to XSS.
        // The application uses a strict policy that should NOT be vulnerable.

        PolicyFactory policy = ResourceValidationConstants.STRICT_SANITIZATION_POLICY;

        String pocPayload1 = "<noscript><style></noscript><script>alert(1)</script>";
        String sanitized1 = policy.sanitize(pocPayload1);
        
        // The strict policy (default factory) should strip everything not whitelisted. 
        // Since nothing is whitelisted, it should ideally be empty or just text content if any remains valid text.
        // But definitively NO <script> tags should survive.
        Assertions.assertFalse(sanitized1.contains("<script>"), "Sanitized output should not contain script tags: " + sanitized1);
        Assertions.assertFalse(sanitized1.contains("alert(1)"), "Sanitized output should not contain executable code: " + sanitized1);

        String pocPayload2 = "<p><style></p><script>alert(1)</script>";
        String sanitized2 = policy.sanitize(pocPayload2);
        Assertions.assertFalse(sanitized2.contains("<script>"), "Sanitized output should not contain script tags: " + sanitized2);
        Assertions.assertFalse(sanitized2.contains("alert(1)"), "Sanitized output should not contain executable code: " + sanitized2);
    }
    
    @Test
    void act_as_strict_policy() {
        PolicyFactory policy = ResourceValidationConstants.STRICT_SANITIZATION_POLICY;
        
        String input = "<div><b>bold</b><script>alert('xss')</script></div>";
        String output = policy.sanitize(input);
        
        // Default builder().toFactory() allows NO elements.
        // So it should strip all tags.
        Assertions.assertEquals("bold", output, "Strict policy should strip all tags");
    }
}
