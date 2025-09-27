export class AsyncGuard {
    private current?: Promise<unknown>
    async run<T>(fn: () => Promise<T>): Promise<T> {
        if (this.current) return this.current as Promise<T>
        const p = fn().finally(() => { this.current = undefined })
        this.current = p
        return p
    }
}
