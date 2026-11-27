package org.finos.calm.domain;

/**
 * Identifies a stored resource independently of the active storage backend.
 *
 * <p>Numeric modes (MongoDB and standalone) use {@link NumericResourceId}. GitHub mode uses
 * {@link GitHubResourceId}, whose stem/path/variant triple resolves through the resource registry.
 * Keeping the two shapes separate lets store calls stay numeric where the data is numeric and
 * composite where the data comes from a cloned repository.</p>
 */
public sealed interface ResourceId permits NumericResourceId, GitHubResourceId {
}
