package org.finos.calm.assets;

import jakarta.ws.rs.core.EntityTag;
import jakarta.ws.rs.core.Request;
import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.stream.Stream;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TestImageAssetShould {

    private static final Path FIXTURES = Path.of("src/test/resources/assets");

    static final String SVG = """
            <?xml version="1.0" encoding="UTF-8"?>
            <!-- An inert logo that uses each feature the checks allow -->
            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24">
              <title>Example</title>
              <metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></metadata>
              <defs>
                <linearGradient id="g"><stop offset="0" stop-color="#0f766e"/></linearGradient>
                <path id="p" d="M2 2h20v20H2z"/>
              </defs>
              <style>.mark { fill: url(#g); }</style>
              <use href="#p" class="mark"/>
              <use xlink:href="#p" fill="url( '#g' )" style="stroke: url(#g)"/>
            </svg>
            """;

    private static byte[] fixture(String name) throws IOException {
        return Files.readAllBytes(FIXTURES.resolve(name));
    }

    private static ImageAsset svg(String text) {
        return ImageAsset.read("logo.svg", text.getBytes(StandardCharsets.UTF_8));
    }

    private static String svgProblem(String text) {
        return assertThrows(IllegalArgumentException.class, () -> svg(text)).getMessage();
    }

    @ParameterizedTest
    @MethodSource("supportedFiles")
    void name_the_media_type_of_each_supported_image(String file, String mediaType) throws IOException {
        assertThat(ImageAsset.read(file, fixture(file)).mediaType(), equalTo(mediaType));
    }

    static Stream<Arguments> supportedFiles() {
        return Stream.of(
                Arguments.of("logo-24x12.png", "image/png"),
                Arguments.of("logo-24x12.jpg", "image/jpeg"),
                Arguments.of("logo-24x12-lossy.webp", "image/webp"),
                Arguments.of("logo-24x12-lossless.webp", "image/webp"),
                Arguments.of("logo-24x12-alpha.webp", "image/webp"),
                Arguments.of("logo-2048x1.png", "image/png"));
    }

    @Test
    void accept_an_svg_with_only_fragment_references_and_name_its_type() {
        assertThat(svg(SVG).mediaType(), equalTo("image/svg+xml"));
    }

    @Test
    void take_the_type_from_the_extension_in_any_case() throws IOException {
        assertThat(ImageAsset.read("LOGO.JPEG", fixture("logo-24x12.jpg")).mediaType(), equalTo("image/jpeg"));
    }

    @Test
    void give_a_version_that_changes_with_the_content() throws IOException {
        ImageAsset png = ImageAsset.read("a.png", fixture("logo-24x12.png"));

        assertThat(png.version(), matchesPattern("[0-9a-f]{16}"));
        assertThat(ImageAsset.read("b.png", fixture("logo-24x12.png")).version(), equalTo(png.version()));
        assertThat(ImageAsset.read("c.png", fixture("logo-2048x1.png")).version(), not(png.version()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"logo-2049x1.png", "logo-2049x1.jpg", "logo-2049x1-lossy.webp", "logo-2049x1-lossless.webp",
            "logo-2049x1-alpha.webp"})
    void read_the_width_and_height_of_each_raster_type_and_refuse_a_side_over_2048(String file) throws IOException {
        byte[] bytes = fixture(file);

        IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () -> ImageAsset.read(file, bytes));

        assertThat(e.getMessage(), equalTo("is 2049 x 1 pixels. Each side must be from 1 to 2048"));
    }

    @Test
    void refuse_a_png_with_no_pixels() throws IOException {
        byte[] bytes = fixture("logo-24x12.png");
        Arrays.fill(bytes, 16, 20, (byte) 0);

        IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () -> ImageAsset.read("a.png", bytes));

        assertThat(e.getMessage(), startsWith("is 0 x 12 pixels"));
    }

    @Test
    void accept_a_file_at_the_size_limit_and_refuse_one_byte_more() {
        String start = "<svg xmlns='http://www.w3.org/2000/svg'><!--";
        String end = "--></svg>";
        String atLimit = start + "x".repeat(ImageAsset.MAX_BYTES - start.length() - end.length()) + end;

        assertThat(svg(atLimit).bytes().length, equalTo(ImageAsset.MAX_BYTES));
        assertThat(svgProblem(atLimit.replace("<!--", "<!-- ")), equalTo("is 262145 bytes, more than the limit of 262144"));
    }

    @ParameterizedTest
    @MethodSource("mismatchedFiles")
    void refuse_bytes_that_are_not_the_type_of_the_extension(String name, String fixture, String problem) throws IOException {
        byte[] bytes = fixture == null ? "not an image".getBytes(StandardCharsets.UTF_8) : fixture(fixture);

        IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () -> ImageAsset.read(name, bytes));

        assertThat(e.getMessage(), startsWith(problem));
    }

    static Stream<Arguments> mismatchedFiles() {
        return Stream.of(
                Arguments.of("logo.png", "logo-24x12.jpg", "is not a PNG image"),
                Arguments.of("logo.jpg", "logo-24x12.png", "is not a JPEG image"),
                Arguments.of("logo.webp", "logo-24x12.png", "is not a WebP image"),
                Arguments.of("logo.svg", "logo-24x12.png", "is not an SVG image"),
                Arguments.of("logo.png", null, "is not a PNG image"),
                Arguments.of("logo.gif", "logo-24x12.png", "must end in .png, .jpg, .jpeg, .webp or .svg"),
                Arguments.of("logo", "logo-24x12.png", "must end in .png, .jpg, .jpeg, .webp or .svg"));
    }

    @Test
    void refuse_a_truncated_jpeg_with_no_frame_header() throws IOException {
        byte[] bytes = Arrays.copyOf(fixture("logo-24x12.jpg"), 20);

        IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () -> ImageAsset.read("a.jpg", bytes));

        assertThat(e.getMessage(), equalTo("is not a JPEG image with a frame header"));
    }

    @ParameterizedTest
    @MethodSource("activeOrExternalSvg")
    void refuse_svg_content_that_could_run_or_load_a_resource(String svg, String problem) {
        assertThat(svgProblem(svg), equalTo(problem));
    }

    static Stream<Arguments> activeOrExternalSvg() {
        String open = "<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'>";
        return Stream.of(
                Arguments.of(open + "<script>alert(document.cookie)</script></svg>", "has a script element"),
                Arguments.of(open + "<SCRIPT>alert(1)</SCRIPT></svg>", "has a SCRIPT element"),
                Arguments.of(open + "<foreignObject><iframe xmlns='http://www.w3.org/1999/xhtml' src='https://x.test'/>"
                        + "</foreignObject></svg>", "has a foreignObject element"),
                Arguments.of("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>", "has an event handler attribute onload"),
                Arguments.of(open + "<rect xlink:onclick='alert(1)'/></svg>", "has an event handler attribute onclick"),
                Arguments.of(open + "<a href='javascript:alert(1)'><rect/></a></svg>", "has an href that is not a #fragment"),
                Arguments.of(open + "<image xlink:href='https://tracker.test/p.png'/></svg>", "has an href that is not a #fragment"),
                Arguments.of(open + "<use href='https://tracker.test/sprite.svg#a'/></svg>", "has an href that is not a #fragment"),
                Arguments.of(open + "<image href='data:image/svg+xml;base64,PHN2Zy8+'/></svg>", "has an href that is not a #fragment"),
                Arguments.of(open + "<a><set attributeName='href' to='javascript:alert(1)'/></a></svg>", "animates an href"),
                Arguments.of(open + "<a><animate attributeName='xlink:href' values='javascript:alert(1)'/></a></svg>", "animates an href"),
                Arguments.of(open + "<rect fill='url(https://tracker.test/f)'/></svg>", "has a url() that is not a #fragment"),
                Arguments.of(open + "<rect style=\"fill: URL('//tracker.test/f')\"/></svg>", "has a url() that is not a #fragment"),
                Arguments.of(open + "<style>rect { fill: url(#ok) } circle { fill: url(\"https://tracker.test/f\") }</style></svg>",
                        "has a url() that is not a #fragment"),
                Arguments.of(open + "<style><![CDATA[@import 'https://tracker.test/s.css';]]></style></svg>",
                        "has a CSS @import, image-set() or src()"),
                Arguments.of(open + "<style>rect { fill: -webkit-image-set('https://tracker.test/f' 1x) }</style></svg>",
                        "has a CSS @import, image-set() or src()"),
                Arguments.of(open + "<rect style=\"fill: src('https://tracker.test/f')\"/></svg>",
                        "has a CSS @import, image-set() or src()"),
                Arguments.of(open + "<html:iframe xmlns:html='http://www.w3.org/1999/xhtml' src='https://tracker.test/'/></svg>",
                        "has an HTML element iframe"),
                Arguments.of(open + "<style>rect { fill: u\\72l(https://tracker.test/f) }</style></svg>", "has a CSS escape"),
                // The style sheet is the text of the whole element: a CDATA section, a comment, a character reference
                // or a child element must not split a rule out of the check.
                Arguments.of(open + "<style>@im<![CDATA[port]]> 'https://tracker.test/s.css';</style></svg>",
                        "has a CSS @import, image-set() or src()"),
                Arguments.of(open + "<style>@im<!-- -->port 'https://tracker.test/s.css';</style></svg>",
                        "has a CSS @import, image-set() or src()"),
                Arguments.of(open + "<style>&#64;import 'https://tracker.test/s.css';</style></svg>",
                        "has a CSS @import, image-set() or src()"),
                Arguments.of(open + "<style>rect { fill: ur<![CDATA[l(https://tracker.test/f) }]]></style></svg>",
                        "has a url() that is not a #fragment"),
                Arguments.of(open + "<style>rect { fill: url(#a) } circle { fill: u<g/>rl(https://tracker.test/f) }</style></svg>",
                        "has a url() that is not a #fragment"),
                Arguments.of("<?xml-stylesheet href='https://tracker.test/s.css'?>" + open + "</svg>",
                        "has a processing instruction"),
                Arguments.of("<!DOCTYPE svg [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]>" + open + "<text>&xxe;</text></svg>",
                        "has a DOCTYPE"),
                Arguments.of("<!DOCTYPE svg [<!ENTITY a 'aaaaaaaaaa'><!ENTITY b '&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;'>]>"
                        + open + "<text>&b;</text></svg>", "has a DOCTYPE"),
                Arguments.of("<!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'https://tracker.test/svg11.dtd'>" + open + "</svg>",
                        "has a DOCTYPE"),
                Arguments.of("<html xmlns='http://www.w3.org/1999/xhtml'><svg xmlns='http://www.w3.org/2000/svg'/></html>",
                        "is not an SVG image: the root element must be svg in the SVG namespace"),
                Arguments.of("<svg><rect/></svg>", "is not an SVG image: the root element must be svg in the SVG namespace"),
                Arguments.of(open + "<rect></svg>", "is not an SVG image: it is not well-formed XML"),
                Arguments.of("", "is not an SVG image: it is not well-formed XML"));
    }

    @Test
    void send_the_bytes_with_their_exact_type_a_sandbox_policy_and_a_private_cache_that_revalidates() throws IOException {
        ImageAsset png = ImageAsset.read("logo.png", fixture("logo-24x12.png"));

        try (Response response = png.response(request(false), null)) {
            assertThat(response.getStatus(), equalTo(200));
            assertThat(response.getEntity(), equalTo(png.bytes()));
            assertThat(response.getMediaType().toString(), equalTo("image/png"));
            assertThat(response.getEntityTag().getValue(), equalTo(png.version()));
            assertThat(response.getHeaderString("Cache-Control"), equalTo("private, no-cache"));
            assertThat(response.getHeaderString("Content-Security-Policy"),
                    equalTo("default-src 'none'; style-src 'unsafe-inline'; sandbox"));
        }
    }

    @Test
    void let_a_browser_keep_the_asset_only_when_the_requested_version_matches() throws IOException {
        ImageAsset png = ImageAsset.read("logo.png", fixture("logo-24x12.png"));

        try (Response matching = png.response(request(false), png.version());
             Response other = png.response(request(false), "0000000000000000")) {
            assertThat(matching.getHeaderString("Cache-Control"), equalTo("private, max-age=31536000, immutable"));
            assertThat(other.getHeaderString("Cache-Control"), equalTo("private, no-cache"));
        }
    }

    @Test
    void answer_a_request_with_the_current_etag_with_304_and_no_body() throws IOException {
        ImageAsset png = ImageAsset.read("logo.png", fixture("logo-24x12.png"));

        try (Response response = png.response(request(true), null)) {
            assertThat(response.getStatus(), equalTo(304));
            assertThat(response.hasEntity(), equalTo(false));
            assertThat(response.getEntityTag().getValue(), equalTo(png.version()));
            assertThat(response.getHeaderString("Content-Security-Policy"), containsString("sandbox"));
        }
    }

    private static Request request(boolean etagMatches) {
        Request request = mock(Request.class);
        when(request.evaluatePreconditions(any(EntityTag.class)))
                .thenReturn(etagMatches ? Response.notModified() : null);
        return request;
    }
}
