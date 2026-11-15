package org.finos.calm.extensions;

import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Checks a caller-supplied path and query and builds the backend URI from them (ADR 0011). Each
 * check works on the raw, percent-encoded form, so that an encoded or double-encoded form cannot
 * hide a dot segment, an extra segment or user info. An encoded slash is not allowed, because a
 * backend that decodes it before routing sees a path other than the one that Hub matched. For the
 * same reason, an encoded look-alike of /, \, ., %, @ or ; is not allowed: a backend that
 * normalises Unicode (NFKC) before routing reads U+FF0F as a slash, U+2100 as "a/c", and U+2025 as "..". A
 * matrix parameter is not allowed, because JAX-RS drops it from the path that Hub matches.
 */
public final class ExtensionPaths {

    /** Lower case. The clients refuse a path value that would give one of these (test resource extensions-test/path-values.json). */
    public static final List<String> FORBIDDEN = List.of("..", "%2e", "%2f", "%5c", "%25", "%40", "\\", "//", "@", ";",
            // Visual look-alikes of / and \ that NFKC does not change: U+2044 fraction slash, U+2215 division slash,
            // U+2216 set minus, U+29F5 reverse solidus operator, U+29F8 big solidus.
            "%e2%81%84", "%e2%88%95", "%e2%88%96", "%e2%a7%b5", "%e2%a7%b8",
            // The code points whose NFKC form contains / or \: U+2100 (a/c), U+2101 (a/s), U+2105 (c/o), U+2106 (c/u),
            // U+FE68 small reverse solidus, U+FF0F fullwidth solidus and U+FF3C fullwidth reverse solidus.
            "%e2%84%80", "%e2%84%81", "%e2%84%85", "%e2%84%86", "%ef%b9%a8", "%ef%bc%8f", "%ef%bc%bc",
            // The code points whose NFKC form is only ., %, @ or ;: U+037E, U+2024 to U+2026, U+FE14, U+FE19, U+FE30,
            // U+FE52, U+FE54, U+FE6A, U+FE6B, U+FF05, U+FF0E, U+FF1B and U+FF20. U+2025 becomes "..".
            "%cd%be", "%e2%80%a4", "%e2%80%a5", "%e2%80%a6", "%ef%b8%94", "%ef%b8%99", "%ef%b8%b0", "%ef%b9%92",
            "%ef%b9%94", "%ef%b9%aa", "%ef%b9%ab", "%ef%bc%85", "%ef%bc%8e", "%ef%bc%9b", "%ef%bc%a0");

    public static final String NOT_ALLOWED = "The extension path or query is not allowed";

    private ExtensionPaths() {
    }

    /** Returns the path when it is safe to send to a backend, or throws 400. */
    public static String checkPath(String rawPath) {
        if (rawPath == null || !rawPath.startsWith("/") || !printableAscii(rawPath, "?#")) {
            throw badRequest();
        }
        if (hasForbiddenPart(rawPath) || encodesControlCharacter(rawPath.toLowerCase(Locale.ROOT))) {
            throw badRequest();
        }
        for (String segment : rawPath.split("/", -1)) {
            if (segment.equals(".")) {
                throw badRequest();
            }
        }
        try {
            if (!URI.create("http://h" + rawPath).normalize().getRawPath().equals(rawPath)) {
                throw badRequest();
            }
        } catch (IllegalArgumentException e) {
            throw badRequest();
        }
        return normalise(rawPath);
    }

    /**
     * The one list of forbidden parts. The proxy and the read-only filter both use it, so that they
     * cannot accept different paths. "%25" also covers each double-encoded form.
     */
    public static boolean hasForbiddenPart(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        return FORBIDDEN.stream().anyMatch(lower::contains);
    }

    private static String normalise(String path) {
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < path.length(); i++) {
            char c = path.charAt(i);
            if (c == '%') {
                char decoded = (char) Integer.parseInt(path.substring(i + 1, i + 3), 16);
                if ((decoded >= 'a' && decoded <= 'z') || (decoded >= 'A' && decoded <= 'Z')
                        || (decoded >= '0' && decoded <= '9') || "-._~".indexOf(decoded) >= 0) {
                    result.append(decoded);
                } else {
                    result.append(path.substring(i, i + 3).toUpperCase(Locale.ROOT));
                }
                i += 2;
            } else {
                result.append(c);
            }
        }
        return result.toString();
    }

    /**
     * Sorts the parameters by name, and keeps the order of the values of one name, because the CLI
     * sends an array as a repeated name. Empty parameters are dropped. Returns "" for no query.
     */
    static String canonicalQuery(String rawQuery) {
        if (rawQuery == null || rawQuery.isEmpty()) {
            return "";
        }
        if (!printableAscii(rawQuery, "#") || encodesControlCharacter(rawQuery.toLowerCase(Locale.ROOT))) {
            throw badRequest();
        }
        List<String> parameters = new ArrayList<>();
        for (String parameter : rawQuery.split("&")) {
            if (!parameter.isEmpty()) {
                parameters.add(parameter);
            }
        }
        parameters.sort(Comparator.comparing(ExtensionPaths::name));
        return String.join("&", parameters);
    }

    /**
     * Resolves {@code pathAndQuery} under the backend URL with {@link URI#resolve}, then checks that
     * the scheme, host, port and base path are still those of the backend.
     */
    static URI resolve(URI backend, String pathAndQuery) {
        String basePath = backend.getRawPath() == null || backend.getRawPath().isEmpty() ? "/" : backend.getRawPath();
        if (!basePath.endsWith("/")) {
            basePath = basePath + "/";
        }
        try {
            URI base = backend.resolve(basePath);
            // "./" keeps a first segment with a colon from being read as a scheme.
            URI target = base.resolve("." + pathAndQuery);
            if (target.getScheme() == null || !target.getScheme().equalsIgnoreCase(backend.getScheme())
                    || target.getHost() == null || !target.getHost().equalsIgnoreCase(backend.getHost())
                    || port(target) != port(backend) || target.getRawUserInfo() != null
                    || target.getRawFragment() != null || target.getRawPath() == null
                    || !target.getRawPath().startsWith(basePath)) {
                throw badRequest();
            }
            return target;
        } catch (IllegalArgumentException e) {
            throw badRequest();
        }
    }

    private static String name(String parameter) {
        int equals = parameter.indexOf('=');
        return equals < 0 ? parameter : parameter.substring(0, equals);
    }

    private static int port(URI uri) {
        if (uri.getPort() != -1) {
            return uri.getPort();
        }
        return "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
    }

    private static boolean printableAscii(String value, String forbidden) {
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c <= 0x20 || c >= 0x7f || forbidden.indexOf(c) >= 0) {
                return false;
            }
        }
        return true;
    }

    private static boolean encodesControlCharacter(String lower) {
        return lower.matches(".*%([01][0-9a-f]|7f).*");
    }

    private static ExtensionProxyException badRequest() {
        return new ExtensionProxyException(400, NOT_ALLOWED);
    }
}
