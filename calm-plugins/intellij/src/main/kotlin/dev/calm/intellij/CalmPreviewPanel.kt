package dev.calm.intellij

import com.intellij.ide.ui.LafManagerListener
import com.google.gson.Gson
import com.google.gson.JsonParser
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.command.undo.UndoManager
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.TextEditor
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.editor.Document
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileDocumentManagerListener
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.openapi.vfs.newvfs.BulkFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import java.awt.BorderLayout
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.SwingConstants

class CalmPreviewPanel(private val project: Project) : JPanel(BorderLayout()), Disposable {
    private val gson = Gson()
    private var browser: JBCefBrowser? = null
    private var file: VirtualFile? = null
    private var ready = false
    private var disposed = false
    private var revision = 0L
    private var publishScheduled = false

    init {
        if (!JBCefApp.isSupported()) {
            add(JLabel("CALM Canvas requires the IDE's bundled JetBrains Runtime with JCEF.", SwingConstants.CENTER))
        } else {
            val view = JBCefBrowser()
            browser = view
            Disposer.register(this, view)
            val query = JBCefJSQuery.create(view as JBCefBrowserBase)
            Disposer.register(this, query)
            query.addHandler { message ->
                later { if (message == "ready") { ready = true; publishTheme(); publish() } else handleRequest(message) }
                null
            }
            add(view.component, BorderLayout.CENTER)
            val script = resource("/webview/index.js")
            val css = resource("/webview/index.css")
            view.loadHTML(PreviewHtml.render(script, css, query.inject("payload"), PreviewTheme.css(PreviewTheme.colors())))
        }

        EditorFactory.getInstance().eventMulticaster.addDocumentListener(object : DocumentListener {
            override fun documentChanged(event: DocumentEvent) {
                if (FileDocumentManager.getInstance().getFile(event.document) == file && !publishScheduled) {
                    publishScheduled = true
                    later { publishScheduled = false; publish() }
                }
            }
        }, this)
        val connection = ApplicationManager.getApplication().messageBus.connect(this)
        connection.subscribe(LafManagerListener.TOPIC, LafManagerListener { later { publishTheme() } })
        connection.subscribe(FileDocumentManagerListener.TOPIC, object : FileDocumentManagerListener {
            override fun beforeDocumentSaving(document: Document) {
                val saved = FileDocumentManager.getInstance().getFile(document)
                later { if (saved == file) publish() }
            }
        })
        connection.subscribe(VirtualFileManager.VFS_CHANGES, object : BulkFileListener {
            override fun after(events: List<VFileEvent>) {
                val paths = events.map { it.path }.toSet()
                later { if (file?.path in paths || file?.isValid == false) publish() }
            }
        })
    }

    fun open(target: VirtualFile) {
        file = target
        publish()
    }

    private fun publishTheme() {
        if (!ready || disposed) return
        val colors = PreviewTheme.colors()
        send(mapOf("type" to "themeUpdated", "colors" to colors, "dark" to PreviewTheme.isDark(colors)))
    }

    private fun publish() {
        if (!ready || disposed) return
        val target = file ?: return
        val message = mutableMapOf<String, Any>(
            "type" to "modelUpdated", "documentId" to target.url,
            "fileName" to target.name, "revision" to ++revision
        )
        if (!target.isValid) {
            message["error"] = "This file was deleted or is no longer available."
        } else {
            val document = FileDocumentManager.getInstance().getDocument(target)
            if (document == null) message["error"] = "Unable to read this file as text."
            else {
                message["json"] = document.text
                message["version"] = document.modificationStamp.toString()
                message["writable"] = target.isWritable && document.isWritable
                val editor = FileEditorManager.getInstance(project).getEditors(target).filterIsInstance<TextEditor>().firstOrNull()
                val undo = UndoManager.getInstance(project)
                message["canUndo"] = editor != null && undo.isUndoAvailable(editor)
                message["canRedo"] = editor != null && undo.isRedoAvailable(editor)
            }
        }
        send(message)
    }

    private fun handleRequest(payload: String) {
        var requestId: String? = null
        try {
            val request = JsonParser.parseString(payload).asJsonObject
            requestId = request.get("requestId").asString
            val type = request.get("type").asString
            require(type in setOf("applyEdit", "undo", "redo")) { "Unknown canvas action." }
            val target = requireNotNull(file?.takeIf { it.isValid }) { "The file is no longer available." }
            val document = requireNotNull(FileDocumentManager.getInstance().getDocument(target))
            DocumentEdit.checkSnapshot(request.get("documentId").asString, request.get("version").asString,
                target.url, document.modificationStamp.toString())
            require(target.isWritable && document.isWritable) { "This document is read only." }
            // Keep a real text editor attached so native document undo is available from both surfaces.
            val editor = FileEditorManager.getInstance(project).openFile(target, false).filterIsInstance<TextEditor>().firstOrNull()
            requireNotNull(editor) { "Unable to open the JSON text editor." }
            when (type) {
                "applyEdit" -> {
                    val json = request.get("json").asString
                    val parsed = JsonParser.parseString(json).asJsonObject
                    require(parsed.get("nodes")?.isJsonArray == true &&
                        (!parsed.has("relationships") || parsed.get("relationships").isJsonArray)) { "Expected a CALM architecture." }
                    WriteCommandAction.runWriteCommandAction(project, "Edit CALM architecture", null, Runnable {
                        DocumentEdit.checkSnapshot(request.get("documentId").asString, request.get("version").asString,
                            target.url, document.modificationStamp.toString())
                        val edit = DocumentEdit.replacement(document.text, json)
                        if (edit.start != edit.end || edit.text.isNotEmpty()) document.replaceString(edit.start, edit.end, edit.text)
                    })
                }
                else -> {
                    val undo = UndoManager.getInstance(project)
                    if (type == "undo") {
                        require(undo.isUndoAvailable(editor)) { "Nothing to undo." }; undo.undo(editor)
                    } else {
                        require(undo.isRedoAvailable(editor)) { "Nothing to redo." }; undo.redo(editor)
                    }
                }
            }
            send(mapOf("type" to "editResult", "requestId" to requestId, "ok" to true))
        } catch (exception: Exception) {
            send(mapOf("type" to "editResult", "requestId" to requestId, "ok" to false,
                "error" to (exception.message ?: "Unable to apply this edit.")))
        }
        publish()
    }

    private fun send(message: Any) {
        browser?.cefBrowser?.executeJavaScript(
            "window.dispatchEvent(new MessageEvent('message',{data:${gson.toJson(message)}}));", "", 0
        )
    }

    private fun later(action: () -> Unit) {
        ApplicationManager.getApplication().invokeLater { if (!disposed) action() }
    }

    private fun resource(path: String): String =
        requireNotNull(javaClass.getResourceAsStream(path)) { "Missing bundled canvas: $path" }
            .bufferedReader().use { it.readText() }

    override fun dispose() { disposed = true; browser = null; file = null }
}
