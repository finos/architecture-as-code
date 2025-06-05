package org.finos.calm.resources;

import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;

public class ResourceValidationConstants {
    public static final String NAMESPACE_REGEX = "^[A-Za-z0-9-]+$";
    public static final String NAMESPACE_MESSAGE = "namespace must match pattern '^[A-Za-z0-9-]+$'";
    public static final String VERSION_REGEX = "^(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)$";
    public static final String VERSION_MESSAGE = "version must match pattern '^(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)$'";
    public static final PolicyFactory STRICT_SANITIZATION_POLICY = new HtmlPolicyBuilder().toFactory();

}
