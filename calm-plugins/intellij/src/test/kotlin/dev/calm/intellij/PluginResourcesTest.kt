package dev.calm.intellij

import org.junit.Assert.*
import org.junit.Test
import javax.xml.parsers.DocumentBuilderFactory

class PluginResourcesTest {
    @Test fun `packaged descriptor targets the new SDK and declares the browser dependency`() {
        val stream = requireNotNull(javaClass.getResourceAsStream("/META-INF/plugin.xml"))
        val xml = stream.use { DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(it) }
        val version = xml.getElementsByTagName("version").item(0).textContent
        assertFalse(version.contains("@"))
        val compatibility = xml.getElementsByTagName("idea-version").item(0).attributes
        assertEquals("262.9437.185", compatibility.getNamedItem("since-build").nodeValue)
        assertNull(compatibility.getNamedItem("until-build"))
        val dependencies = xml.getElementsByTagName("depends")
        assertTrue((0 until dependencies.length).any { dependencies.item(it).textContent == "com.intellij.modules.jcef" })
        for (resource in listOf("/webview/index.js", "/webview/index.css", "/META-INF/pluginIcon.svg", "/icons/calm.svg", "/META-INF/calm-upstream/LICENSE")) {
            assertNotNull(resource, javaClass.getResource(resource))
        }
    }
}
