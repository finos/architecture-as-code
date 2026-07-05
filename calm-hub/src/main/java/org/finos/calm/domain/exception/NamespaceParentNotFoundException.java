package org.finos.calm.domain.exception;

public class NamespaceParentNotFoundException extends RuntimeException {
    public NamespaceParentNotFoundException(String parentNamespace) {
        super("Parent namespace does not exist: " + parentNamespace);
    }
}
