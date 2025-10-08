// Simple event emitter for MVVM without vscode dependencies
export class Emitter<T> {
    private listeners: Array<(data: T) => void> = []

    get event() {
        return (listener: (data: T) => void) => {
            this.listeners.push(listener)
            return {
                dispose: () => {
                    const index = this.listeners.indexOf(listener)
                    if (index >= 0) this.listeners.splice(index, 1)
                }
            }
        }
    }

    fire(data: T) {
        this.listeners.forEach(listener => listener(data))
    }

    dispose() {
        this.listeners = []
    }
}