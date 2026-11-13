package org.finos.calm.extensions;

import org.finos.calm.domain.extensions.ExtensionManifest;

import java.net.URI;
import java.util.Optional;

/** An enabled extension with its operator settings. The backend URL is for Hub only. */
public record RegisteredExtension(ExtensionManifest manifest, int order, Optional<URI> backendUrl) {

    public String id() {
        return manifest.id();
    }
}
