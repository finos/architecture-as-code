package org.finos.calm.domain;

/**
 * A resource identifier for GitHub storage: the filename stem plus optional path and variant.
 *
 * <p>{@code path} is the slash-joined parent folders relative to the clone root, with the first
 * known type folder removed. {@code variant} is the token from a compound extension. {@code null}
 * means "not supplied" and does not filter; an empty string means "none" and matches only a root
 * file or a single-extension file. Without the empty form, a client cannot select the root
 * {@code foo.json} when {@code team/foo.json} also exists.</p>
 */
public record GitHubResourceId(String name, String path, String variant) implements ResourceId {
}
