package dev.calm.intellij

import org.junit.Assert.*
import org.junit.Test

class PreviewTest {
    @Test fun `only supported CALM files enable the action`() {
        assertTrue(CalmFiles.accepts("service.architecture.json"))
        assertTrue(CalmFiles.accepts("model.calm.json"))
        assertFalse(CalmFiles.accepts("package.json"))
        assertFalse(CalmFiles.accepts("model.calm.json.bak"))
    }

    @Test fun `embedded assets cannot terminate their HTML elements`() {
        val html = PreviewHtml.render("const x='</ScRiPt><script>bad()';", "/* </style> */", "send(payload)")
        assertFalse(html.contains("</ScRiPt>"))
        assertTrue(html.contains("<\\/script>"))
        assertTrue(html.contains("connect-src 'none'"))
        assertTrue(html.contains("send(payload)"))
    }
}
