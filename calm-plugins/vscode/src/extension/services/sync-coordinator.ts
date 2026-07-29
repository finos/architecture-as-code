/**
 * Prevents infinite sync loops between canvas edits and file changes.
 *
 * The only dangerous loop: canvas writes file → file watcher fires → sends back to canvas.
 * We block file→canvas propagation for a short window after canvas→file writes.
 * Canvas→file writes are NEVER blocked — user edits must always persist.
 */
export class SyncCoordinator {
  private suppressFileEvents = false;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly SUPPRESS_MS = 1000;

  fileChanged(): boolean {
    if (this.suppressFileEvents) {
      return false;
    }
    return true;
  }

  canvasChanged(): boolean {
    this.suppressFileEvents = true;
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    this.resetTimer = setTimeout(() => {
      this.suppressFileEvents = false;
      this.resetTimer = null;
    }, this.SUPPRESS_MS);
    return true;
  }

  dispose(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
  }
}
