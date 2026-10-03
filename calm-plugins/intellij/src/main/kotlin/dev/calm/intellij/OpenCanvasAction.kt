package dev.calm.intellij

import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.project.DumbAwareAction
import com.intellij.openapi.wm.ToolWindowManager

class OpenCanvasAction : DumbAwareAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT

    override fun update(e: AnActionEvent) {
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE)
        e.presentation.isEnabledAndVisible = e.project != null && file != null &&
            !file.isDirectory && CalmFiles.accepts(file.name)
    }

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE) ?: return
        if (!CalmFiles.accepts(file.name)) return
        val window = ToolWindowManager.getInstance(project).getToolWindow("CALM Canvas") ?: return
        window.activate {
            val panel = window.contentManager.getContent(0)?.component as? CalmPreviewPanel
            panel?.open(file)
        }
    }
}
