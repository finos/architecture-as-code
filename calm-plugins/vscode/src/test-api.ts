import { PreviewPanelFactory } from './features/preview/preview-panel-factory'
import type { PreviewViewModel } from './features/preview/preview.view-model'

/**
 * Test-only API returned from `activate()` for use by @vscode/test-electron
 * integration tests. Not part of the extension's user-facing contract.
 */
export interface CalmExtensionTestApi {
  /**
   * Resolves `true` when the preview webview posts its `ready` message
   * (JS executed), or `false` on timeout.
   */
  waitForPreviewReady(timeoutMs?: number): Promise<boolean>

  /**
   * Resolves `true` when the preview webview posts its `rendered` message
   * (compositor produced a frame — requestAnimationFrame fired), or `false`
   * on timeout. This is the paint-level probe for regressions like issue
   * #2361 where the webview stays blank despite JS running.
   */
  waitForPreviewRendered(timeoutMs?: number): Promise<boolean>
}

export function createTestApi(factory: PreviewPanelFactory): CalmExtensionTestApi {
  return {
    waitForPreviewReady(timeoutMs = 5000) {
      const vm = factory.getViewModel() as PreviewViewModel
      if (vm.getPreviewState().ready) return Promise.resolve(true)
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          sub.dispose()
          resolve(false)
        }, timeoutMs)
        const sub = vm.onReadyStateChanged((ready) => {
          if (ready) {
            clearTimeout(timer)
            sub.dispose()
            resolve(true)
          }
        })
      })
    },
    waitForPreviewRendered(timeoutMs = 5000) {
      const vm = factory.getViewModel() as PreviewViewModel
      if (vm.getIsRendered()) return Promise.resolve(true)
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          sub.dispose()
          resolve(false)
        }, timeoutMs)
        const sub = vm.onRenderedStateChanged((rendered: boolean) => {
          if (rendered) {
            clearTimeout(timer)
            sub.dispose()
            resolve(true)
          }
        })
      })
    }
  }
}
