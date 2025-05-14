package org.finos.calm.security;

public record UserRequestAttributes(String requestMethod, String username, String path, String namespace) {

}
