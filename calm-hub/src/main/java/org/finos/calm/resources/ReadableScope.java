package org.finos.calm.resources;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.inject.Instance;
import org.finos.calm.security.UserAccessValidator;

import java.util.Optional;
import java.util.Set;
import java.util.function.BiFunction;

/**
 * Shared resolution of the caller's readable namespaces/domains for the counts and search
 * endpoints, so the auth-bypass rule lives in exactly one place rather than being copied into
 * each resource: {@link Optional#empty()} (no filtering — see everything) when auth is disabled
 * or the {@link UserAccessValidator} is not resolvable (no-auth / standalone profile); otherwise
 * the validator's READ-sufficient set (itself empty for global-admin / public-read).
 */
interface ReadableScope {

    /**
     * @param authEnabled       whether authentication is enabled for this deployment
     * @param validatorInstance CDI handle to the {@link UserAccessValidator} (absent in no-auth builds)
     * @param identity          the caller's security identity
     * @param readable          the validator method that yields the caller's readable set
     *                          (e.g. {@code UserAccessValidator::getReadableNamespaces})
     */
    static Optional<Set<String>> resolve(
            boolean authEnabled,
            Instance<UserAccessValidator> validatorInstance,
            SecurityIdentity identity,
            BiFunction<UserAccessValidator, String, Optional<Set<String>>> readable) {
        if (!authEnabled || !validatorInstance.isResolvable()) {
            return Optional.empty();
        }
        return readable.apply(validatorInstance.get(), identity.getPrincipal().getName());
    }
}
