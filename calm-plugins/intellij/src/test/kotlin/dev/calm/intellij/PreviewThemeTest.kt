package dev.calm.intellij

import org.junit.Assert.*
import org.junit.Test
import java.awt.Color
import javax.swing.UIManager

class PreviewThemeTest {
    @Test fun `initial HTML uses the host palette before scripts run`() {
        val colors = mapOf("background" to "#fafafa", "foreground" to "#202020")
        val css = PreviewTheme.css(colors)
        assertFalse(PreviewTheme.isDark(colors))
        assertTrue(css.contains("color-scheme:light"))
        assertTrue(css.contains("--calm-background:#fafafa"))
        val html = PreviewHtml.render("start()", "", "send(payload)", css)
        assertTrue(html.indexOf(css) < html.indexOf("start()"))
        assertTrue(PreviewTheme.isDark(mapOf("background" to "#202530")))
    }

    @Test fun `palette reads changed look and feel colors`() {
        val keys = listOf("Panel.background", "Label.foreground", "Component.focusColor", "Tree.background")
        val previous = keys.associateWith { UIManager.get(it) }
        try {
            keys.forEach { UIManager.put(it, Color(0x123456)) }
            val dark = PreviewTheme.colors()
            assertEquals("#123456", dark["background"])
            assertEquals("#123456", dark["foreground"])
            assertEquals("#123456", dark["accent"])
            assertEquals("#123456", dark["container"])
            assertTrue(PreviewTheme.isDark(dark))
            assertTrue(dark.values.all { it.matches(Regex("#[0-9a-f]{6}")) })
            UIManager.put("Panel.background", Color.WHITE)
            assertFalse(PreviewTheme.isDark(PreviewTheme.colors()))
        } finally {
            previous.forEach { (key, value) -> UIManager.put(key, value) }
        }
    }

    @Test(expected = IllegalArgumentException::class)
    fun `reject invalid palette values`() {
        PreviewTheme.css(mapOf("background" to "</style>"))
    }
}
