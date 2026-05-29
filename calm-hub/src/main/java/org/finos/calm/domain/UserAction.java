package org.finos.calm.domain;

public enum UserAction {
    READ("read"),
    WRITE("write"),
    ADMIN("admin");

    private final String value;

    UserAction(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
