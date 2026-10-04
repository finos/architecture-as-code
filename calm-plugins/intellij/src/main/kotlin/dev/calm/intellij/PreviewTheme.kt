package dev.calm.intellij

import java.awt.Color
import javax.swing.UIManager

object PreviewTheme {
    fun colors(): Map<String, String> {
        fun color(key: String, fallback: Color) = UIManager.getColor(key) ?: fallback
        val background = color("Panel.background", Color(0x2b2d30))
        val foreground = color("Label.foreground", Color(0xdfe1e5))
        val input = color("TextField.background", background)
        val accent = color("Component.focusColor", color("Focus.borderColor", Color(0x3574f0)))
        return mapOf(
            "background" to background,
            "foreground" to foreground,
            "muted" to color("Label.disabledForeground", foreground),
            "border" to color("Component.borderColor", color("Separator.foreground", foreground)),
            "button" to color("Button.background", background),
            "buttonText" to color("Button.foreground", foreground),
            "input" to input,
            "inputText" to color("TextField.foreground", foreground),
            "accent" to accent,
            "accentText" to color("List.selectionForeground", foreground),
            "selection" to color("List.selectionBackground", accent),
            "error" to color("Label.errorForeground", foreground),
            "node" to input,
            "container" to color("Tree.background", background)
        ).mapValues { (_, value) -> "#%06x".format(value.rgb and 0xffffff) }
    }

    fun isDark(colors: Map<String, String>): Boolean {
        val color = Color.decode(colors.getValue("background"))
        return color.red * 0.299 + color.green * 0.587 + color.blue * 0.114 < 128
    }

    fun css(colors: Map<String, String>): String {
        require(colors.keys.all { it.matches(Regex("[a-zA-Z]+")) } &&
            colors.values.all { it.matches(Regex("#[0-9a-fA-F]{6}")) })
        return ":root {" + colors.entries.joinToString("") { (key, value) -> "--calm-$key:$value;" } +
            "color-scheme:${if (isDark(colors)) "dark" else "light"};}"
    }
}
