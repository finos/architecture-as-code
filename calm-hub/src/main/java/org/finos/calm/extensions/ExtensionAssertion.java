package org.finos.calm.extensions;

/**
 * The request-bound claims of one identity assertion (ADR 0010). Hub adds {@code iss}, {@code iat}
 * and {@code exp} when it signs, and {@code bdh} when there is a body. {@code ns} is null unless Hub
 * checked the namespace: when the route scope is {@code read}, {@code write} or {@code admin}.
 * {@code dom} is null unless Hub checked the domain: when the scope is a {@code domain_*} scope.
 */
public record ExtensionAssertion(
        String sub,
        String aud,
        String jti,
        String auth,
        int hubApi,
        String route,
        String scope,
        String ns,
        String dom,
        String htm,
        String htp
) {}
