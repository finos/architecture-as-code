package org.finos.calm.store.util;

/**
 * The synthetic namespace Control's configuration axis is scoped under: {@code domain::controlId}.
 *
 * <p>{@code configurationId} is already a globally unique counter (see ADR 0007), so this exists
 * only to scope <em>listing</em> ("configurations belonging to this control") — not to establish
 * uniqueness. {@code "::"} is safe because {@code DomainStore}'s domain-name validation disallows
 * {@code ":"}.
 *
 * <p>Used by both backends' {@code ControlStore} implementations and both backends' Control
 * migration classes, which must agree on this format byte-for-byte: a mismatch between what a
 * migration writes and what a store reads would make migrated configurations silently
 * unreachable rather than fail loudly.
 */
public final class ControlConfigurationNamespace {

    private ControlConfigurationNamespace() {
    }

    public static String of(String domain, int controlId) {
        return domain + "::" + controlId;
    }
}
