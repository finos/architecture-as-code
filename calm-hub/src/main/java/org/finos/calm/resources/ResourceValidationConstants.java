package org.finos.calm.resources;

import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;

public class ResourceValidationConstants {
    public static final String NAMESPACE_REGEX = "^[A-Za-z0-9-]+$";
    public static final String NAMESPACE_MESSAGE = "namespace must match pattern '^[A-Za-z0-9-]+$'";
    public static final String DOMAIN_NAME_REGEX = "^[A-Za-z0-9-]+$";
    public static final String DOMAIN_NAME_MESSAGE = "domain name must match pattern '^[A-Za-z0-9-]+$'";
    public static final String VERSION_REGEX = "^(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)$";
    public static final String VERSION_MESSAGE = "version must match pattern '^(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)$'";
    public static final String QUERY_PARAM_NO_WHITESPACE_REGEX = "^[A-Za-z0-9_/-]+$";
    public static final String QUERY_PARAM_NO_WHITESPACE_MESSAGE = "Query parameter must contain only alphanumeric characters, hyphens, underscores, and forward slashes";
    public static final PolicyFactory STRICT_SANITIZATION_POLICY = new HtmlPolicyBuilder().toFactory();

}
