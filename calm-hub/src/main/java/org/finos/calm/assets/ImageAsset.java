package org.finos.calm.assets;

import jakarta.ws.rs.core.EntityTag;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Request;
import jakarta.ws.rs.core.Response;

import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * An image that Hub serves from a local file, such as an extension or organisation logo. Hub reads the file at start
 * up and never fetches an image from another location.
 *
 * <p>The UI shows the bytes only as the source of an {@code img}. A browser draws an SVG {@code img} as an image: it
 * runs no script and loads no other resource. The UI gives the {@code img} a {@code data:} URL, not a {@code blob:}
 * URL, because a {@code data:} URL has an opaque origin if someone opens the image as a document, and a {@code blob:}
 * URL has Hub's origin. The headers of {@link #response} do not go with the bytes into either URL: they protect only a
 * user who opens the asset endpoint itself. {@link #read} also refuses SVG content that could run or load a resource
 * in a document, as a second defence.
 */
public record ImageAsset(String mediaType, byte[] bytes, String version) {

    public static final int MAX_BYTES = 256 * 1024;
    /** The largest width or height of a raster image, so that a small file cannot decode to a huge bitmap. */
    public static final int MAX_DIMENSION = 2048;
    /** For a user who opens the asset URL as a document. It does not go with the bytes into a {@code data:} URL. */
    public static final String CONTENT_SECURITY_POLICY = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
    static final String IMMUTABLE = "private, max-age=31536000, immutable";
    static final String REVALIDATE = "private, no-cache";

    private static final Map<String, String> TYPES = Map.of(
            "png", "image/png", "jpg", "image/jpeg", "jpeg", "image/jpeg", "webp", "image/webp", "svg", "image/svg+xml");
    private static final byte[] PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'};
    private static final String SVG_NAMESPACE = "http://www.w3.org/2000/svg";
    private static final String XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
    private static final Set<String> SVG_ACTIVE_ELEMENTS = Set.of("script", "foreignobject", "handler", "listener");
    private static final Pattern CSS_URL = Pattern.compile("(?i)url\\(\\s*['\"]?([^'\")\\s]*)");
    /** CSS functions that load a resource without url(). */
    private static final Pattern CSS_LOADER = Pattern.compile("(?i)@import|image-set\\(|(?<![\\w-])src\\(");

    /**
     * @param fileName names the type by its extension: {@code .png}, {@code .jpg}, {@code .jpeg}, {@code .webp} or
     *                 {@code .svg}. The bytes must hold that type
     * @throws IllegalArgumentException with a reason that reads after the file name, such as "is not a PNG image"
     */
    public static ImageAsset read(String fileName, byte[] bytes) {
        int dot = fileName.lastIndexOf('.');
        String type = dot < 0 ? null : TYPES.get(fileName.substring(dot + 1).toLowerCase(Locale.ROOT));
        if (type == null) {
            throw new IllegalArgumentException("must end in .png, .jpg, .jpeg, .webp or .svg");
        }
        if (bytes.length > MAX_BYTES) {
            throw new IllegalArgumentException("is " + bytes.length + " bytes, more than the limit of " + MAX_BYTES);
        }
        switch (type) {
            case "image/png" -> checkPng(bytes);
            case "image/jpeg" -> checkJpeg(bytes);
            case "image/webp" -> checkWebp(bytes);
            default -> checkSvg(bytes);
        }
        return new ImageAsset(type, bytes, sha256(bytes));
    }

    /**
     * The reply to a GET of the asset. It is private, because the asset URL needs a signed-in user. A browser keeps it
     * without asking again only when {@code requestedVersion}, the {@code v} query parameter, is this content's
     * version; otherwise it asks again with the ETag.
     */
    public Response response(Request request, String requestedVersion) {
        EntityTag tag = new EntityTag(version);
        String cache = version.equals(requestedVersion) ? IMMUTABLE : REVALIDATE;
        Response.ResponseBuilder notModified = request.evaluatePreconditions(tag);
        Response.ResponseBuilder builder = notModified != null ? notModified : Response.ok(bytes, mediaType);
        return builder.tag(tag)
                .header(HttpHeaders.CACHE_CONTROL, cache)
                .header("Content-Security-Policy", CONTENT_SECURITY_POLICY)
                .build();
    }

    private static void checkPng(byte[] b) {
        if (b.length < 24 || !startsWith(b, PNG_SIGNATURE) || !ascii(b, 12, 4).equals("IHDR")) {
            throw notA("PNG");
        }
        checkDimensions(int32(b, 16), int32(b, 20));
    }

    private static void checkJpeg(byte[] b) {
        if (b.length < 4 || (b[0] & 0xff) != 0xff || (b[1] & 0xff) != 0xd8) {
            throw notA("JPEG");
        }
        int i = 2;
        while (i + 4 <= b.length && (b[i] & 0xff) == 0xff) {
            int marker = b[i + 1] & 0xff;
            if (marker == 0xff) {
                i++;
            } else if (marker == 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
                i += 2;
            } else if (marker == 0xd9 || marker == 0xda) {
                break;
            } else if (marker >= 0xc0 && marker <= 0xcf && marker != 0xc4 && marker != 0xc8 && marker != 0xcc) {
                if (i + 9 > b.length) {
                    break;
                }
                checkDimensions(uint16(b, i + 7), uint16(b, i + 5));
                return;
            } else {
                i += 2 + uint16(b, i + 2);
            }
        }
        throw new IllegalArgumentException("is not a JPEG image with a frame header");
    }

    private static void checkWebp(byte[] b) {
        if (b.length < 30 || !ascii(b, 0, 4).equals("RIFF") || !ascii(b, 8, 4).equals("WEBP")) {
            throw notA("WebP");
        }
        switch (ascii(b, 12, 4)) {
            case "VP8 " -> {
                if ((b[23] & 0xff) != 0x9d || (b[24] & 0xff) != 0x01 || (b[25] & 0xff) != 0x2a) {
                    throw notA("WebP");
                }
                checkDimensions(uint16le(b, 26) & 0x3fff, uint16le(b, 28) & 0x3fff);
            }
            case "VP8L" -> {
                if ((b[20] & 0xff) != 0x2f) {
                    throw notA("WebP");
                }
                int bits = uint16le(b, 21) | uint16le(b, 23) << 16;
                checkDimensions((bits & 0x3fff) + 1, (bits >>> 14 & 0x3fff) + 1);
            }
            case "VP8X" -> checkDimensions(uint24le(b, 24) + 1, uint24le(b, 27) + 1);
            default -> throw notA("WebP");
        }
    }

    /**
     * Refuses what could run or load another resource if the SVG were a document: a DTD or entity, a processing
     * instruction (such as xml-stylesheet), a script or foreign element, an event handler, a link or CSS
     * {@code url()} that is not a {@code #fragment}, an animation of a link, a CSS import or escape.
     */
    private static void checkSvg(byte[] bytes) {
        // The JDK parser, so that another StAX implementation on the classpath cannot change these checks.
        XMLInputFactory factory = XMLInputFactory.newDefaultFactory();
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        XMLStreamReader reader = null;
        try {
            reader = factory.createXMLStreamReader(new ByteArrayInputStream(bytes));
            boolean root = true;
            int styleDepth = 0;
            // The style sheet is all the text in the element. A CDATA section, a comment, a character reference or a
            // child element can split it into several events, so check it whole.
            StringBuilder styleText = new StringBuilder();
            while (reader.hasNext()) {
                switch (reader.next()) {
                    case XMLStreamConstants.DTD -> throw new IllegalArgumentException("has a DOCTYPE");
                    case XMLStreamConstants.ENTITY_REFERENCE -> throw new IllegalArgumentException("has an entity reference");
                    case XMLStreamConstants.PROCESSING_INSTRUCTION ->
                            throw new IllegalArgumentException("has a processing instruction");
                    case XMLStreamConstants.START_ELEMENT -> {
                        String name = reader.getLocalName();
                        if (root && (!name.equals("svg") || !SVG_NAMESPACE.equals(reader.getNamespaceURI()))) {
                            throw new IllegalArgumentException("is not an SVG image: the root element must be svg in the "
                                    + "SVG namespace");
                        }
                        root = false;
                        if (SVG_ACTIVE_ELEMENTS.contains(name.toLowerCase(Locale.ROOT))) {
                            throw new IllegalArgumentException("has a " + name + " element");
                        }
                        if (XHTML_NAMESPACE.equals(reader.getNamespaceURI())) {
                            throw new IllegalArgumentException("has an HTML element " + name);
                        }
                        for (int i = 0; i < reader.getAttributeCount(); i++) {
                            checkSvgAttribute(reader.getAttributeLocalName(i), reader.getAttributeValue(i));
                        }
                        styleDepth += name.equals("style") ? 1 : 0;
                    }
                    case XMLStreamConstants.END_ELEMENT -> {
                        if (reader.getLocalName().equals("style") && --styleDepth == 0) {
                            checkCss(styleText.toString());
                            styleText.setLength(0);
                        }
                    }
                    case XMLStreamConstants.CHARACTERS, XMLStreamConstants.CDATA, XMLStreamConstants.SPACE -> {
                        if (styleDepth > 0) {
                            styleText.append(reader.getText());
                        }
                    }
                    default -> {
                        // Comments, white space and the end of the document need no check.
                    }
                }
            }
            if (root) {
                throw new IllegalArgumentException("is not an SVG image: it has no root element");
            }
        } catch (XMLStreamException e) {
            throw new IllegalArgumentException("is not an SVG image: it is not well-formed XML");
        } finally {
            close(reader);
        }
    }

    private static void checkSvgAttribute(String name, String value) {
        String lower = name.toLowerCase(Locale.ROOT);
        if (lower.startsWith("on")) {
            throw new IllegalArgumentException("has an event handler attribute " + name);
        }
        if (lower.equals("href") && !value.strip().startsWith("#")) {
            throw new IllegalArgumentException("has an href that is not a #fragment");
        }
        if (lower.equals("attributename") && value.strip().toLowerCase(Locale.ROOT).endsWith("href")) {
            throw new IllegalArgumentException("animates an href");
        }
        checkCss(value);
    }

    /** Runs on each attribute value and style sheet: a presentation attribute takes CSS values too. */
    private static void checkCss(String text) {
        Matcher url = CSS_URL.matcher(text);
        while (url.find()) {
            if (!url.group(1).startsWith("#")) {
                throw new IllegalArgumentException("has a url() that is not a #fragment");
            }
        }
        if (CSS_LOADER.matcher(text).find()) {
            throw new IllegalArgumentException("has a CSS @import, image-set() or src()");
        }
        // A CSS escape can spell url( so that the check above does not see it.
        if (text.indexOf('\\') >= 0) {
            throw new IllegalArgumentException("has a CSS escape");
        }
    }

    private static void close(XMLStreamReader reader) {
        if (reader == null) {
            return;
        }
        try {
            reader.close();
        } catch (XMLStreamException e) {
            // Nothing to release: the bytes are in memory.
        }
    }

    private static void checkDimensions(int width, int height) {
        if (width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
            throw new IllegalArgumentException("is " + Integer.toUnsignedString(width) + " x " + Integer.toUnsignedString(height)
                    + " pixels. Each side must be from 1 to " + MAX_DIMENSION);
        }
    }

    private static IllegalArgumentException notA(String type) {
        return new IllegalArgumentException("is not a " + type + " image");
    }

    private static boolean startsWith(byte[] b, byte[] prefix) {
        for (int i = 0; i < prefix.length; i++) {
            if (b[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private static String ascii(byte[] b, int offset, int length) {
        return new String(b, offset, length, StandardCharsets.ISO_8859_1);
    }

    private static int int32(byte[] b, int i) {
        return (b[i] & 0xff) << 24 | (b[i + 1] & 0xff) << 16 | (b[i + 2] & 0xff) << 8 | b[i + 3] & 0xff;
    }

    private static int uint16(byte[] b, int i) {
        return (b[i] & 0xff) << 8 | b[i + 1] & 0xff;
    }

    private static int uint16le(byte[] b, int i) {
        return b[i] & 0xff | (b[i + 1] & 0xff) << 8;
    }

    private static int uint24le(byte[] b, int i) {
        return uint16le(b, i) | (b[i + 2] & 0xff) << 16;
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes), 0, 8);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("The JDK has no SHA-256", e);
        }
    }
}
