package dev.calm.intellij

object CalmFiles {
    private val suffixes = listOf(".calm.json", ".architecture.json", ".template.json",
        ".solution.json", ".standard.json", ".guideline.json")

    fun accepts(name: String): Boolean = suffixes.any(name::endsWith)
}
