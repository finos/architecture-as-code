package dev.calm.intellij

/** Match the exact source snapshot, including unsaved edits and the selected file. */
internal object DocumentEdit {
    fun checkSnapshot(expectedId: String, expectedVersion: String, actualId: String, actualVersion: String) {
        require(expectedId == actualId && expectedVersion == actualVersion) {
            "The document changed. Reopen the form and apply your edit to the latest version."
        }
    }

    data class Replacement(val start: Int, val end: Int, val text: String)
    fun replacement(before: String, after: String): Replacement {
        var start = 0
        while (start < minOf(before.length, after.length) && before[start] == after[start]) start++
        var oldEnd = before.length
        var newEnd = after.length
        while (oldEnd > start && newEnd > start && before[oldEnd - 1] == after[newEnd - 1]) { oldEnd--; newEnd-- }
        return Replacement(start, oldEnd, after.substring(start, newEnd))
    }
}
