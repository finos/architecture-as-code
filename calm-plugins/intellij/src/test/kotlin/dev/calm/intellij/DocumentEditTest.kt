package dev.calm.intellij

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class DocumentEditTest {
    @Test fun `rejects stale and cross-document requests including unsaved edits`() {
        DocumentEdit.checkSnapshot("a", "42", "a", "42")
        assertThrows(IllegalArgumentException::class.java) { DocumentEdit.checkSnapshot("a", "42", "b", "42") }
        assertThrows(IllegalArgumentException::class.java) { DocumentEdit.checkSnapshot("a", "42", "a", "43") }
    }

    @Test fun `replacement preserves surrounding text and supports insertion deletion and unicode`() {
        for ((before, after) in listOf("prefix old suffix" to "prefix new suffix", "abc" to "ab", "ab" to "abc", "" to "x", "same" to "same", "😀 hello" to "😀 world")) {
            val edit = DocumentEdit.replacement(before, after)
            assertEquals(after, before.replaceRange(edit.start, edit.end, edit.text))
        }
        assertEquals(DocumentEdit.Replacement(7, 10, "new"), DocumentEdit.replacement("prefix old suffix", "prefix new suffix"))
    }
}
