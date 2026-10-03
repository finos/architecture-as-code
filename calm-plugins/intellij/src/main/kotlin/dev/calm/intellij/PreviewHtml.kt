package dev.calm.intellij

import java.util.UUID

object PreviewHtml {
    fun render(script: String, css: String, bridge: String): String {
        val nonce = UUID.randomUUID().toString().replace("-", "")
        val safeScript = script.replace("</script", "<\\/script", ignoreCase = true)
        val safeCss = css.replace("</style", "<\\/style", ignoreCase = true)
        return """<!doctype html><html><head><meta charset="utf-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-$nonce'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none';">
            <style>$safeCss</style></head><body><div id="root"></div>
            <script nonce="$nonce">window.calmHost={postMessage:function(payload){$bridge}};</script>
            <script nonce="$nonce">$safeScript</script></body></html>""".trimIndent()
    }
}
