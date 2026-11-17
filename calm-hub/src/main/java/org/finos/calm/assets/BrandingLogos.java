package org.finos.calm.assets;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.finos.calm.config.UiConfig;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/** The organisation logos of {@code calm.ui.branding.logo.*}, read once. {@code UiConfigValidator} checks them at startup. */
@ApplicationScoped
public class BrandingLogos {

    public static final String LIGHT = "light";
    public static final String DARK = "dark";

    private final Map<String, ImageAsset> logos = new HashMap<>();

    @Inject
    public BrandingLogos(UiConfig config) {
        config.branding().logo().light().ifPresent(path -> logos.put(LIGHT, load(path)));
        config.branding().logo().dark().ifPresent(path -> logos.put(DARK, load(path)));
    }

    public Optional<ImageAsset> logo(String variant) {
        return Optional.ofNullable(logos.get(variant));
    }

    /** Reads and checks the image at {@code path}. The message of the exception says what is wrong. */
    public static ImageAsset read(String path) {
        try {
            Path file = Path.of(path);
            if (!Files.isRegularFile(file)) {
                throw new IllegalArgumentException("is not a readable file");
            }
            return ImageAsset.read(file.getFileName().toString(), Files.readAllBytes(file));
        } catch (InvalidPathException | IOException e) {
            throw new IllegalArgumentException("is not a readable file");
        }
    }

    private static ImageAsset load(String path) {
        try {
            return read(path);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Invalid calm.ui configuration: logo " + path + " " + e.getMessage(), e);
        }
    }
}
