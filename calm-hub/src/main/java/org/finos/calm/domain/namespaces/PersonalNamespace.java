package org.finos.calm.domain.namespaces;

/**
 * The caller's personal namespace. {@code owned} is true when the caller holds an
 * {@code admin} grant on the namespace itself.
 */
public record PersonalNamespace(String name, boolean exists, boolean owned) {
}
