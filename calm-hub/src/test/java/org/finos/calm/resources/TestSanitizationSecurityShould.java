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
        
        // The strict policy (default factory) should strip everything not allowed. 
        // Since nothing is allowed, it should ideally be empty or just text content if any remains valid text.
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

    @Test
    void neutralise_script_tags_in_domain_error_message() {
        // Mirrors DomainUserAccessResource#invalidDomainResponse, which echoes the path param
        // into the 404 body. The @Pattern guard 400s malicious values before they reach the
        // helper, so this is defence-in-depth against any future caller that bypasses validation.
        String maliciousDomain = "<script>alert('xss')</script>";
        String body = "Invalid domain provided: "
                + ResourceValidationConstants.STRICT_SANITIZATION_POLICY.sanitize(maliciousDomain);

        Assertions.assertEquals("Invalid domain provided: ", body,
                "Domain error body should contain no executable markup");
    }

    @Test
    void neutralise_script_tags_in_namespace_error_message() {
        // Mirrors UserAccessResource#invalidNamespaceResponse — see the domain test above.
        String maliciousNamespace = "<script>alert('xss')</script>";
        String body = "Invalid namespace provided: "
                + ResourceValidationConstants.STRICT_SANITIZATION_POLICY.sanitize(maliciousNamespace);

        Assertions.assertEquals("Invalid namespace provided: ", body,
                "Namespace error body should contain no executable markup");
    }
}
