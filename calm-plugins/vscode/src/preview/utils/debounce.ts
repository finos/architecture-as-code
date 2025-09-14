export class Debouncer {
    private t: ReturnType<typeof setTimeout> | undefined
    run(ms: number, fn: () => void) {
        if (this.t) clearTimeout(this.t)
        this.t = setTimeout(() => { this.t = undefined; fn() }, ms)
    }
    cancel() { if (this.t) { clearTimeout(this.t); this.t = undefined } }
}
