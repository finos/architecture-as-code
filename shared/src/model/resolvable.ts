export class Resolvable<T> {
    constructor(
        public reference: string,
        private _value?: T
    ) {}

    get isResolved(): boolean {
        return !!this._value;
    }

    get value(): T {
        if (!this._value) throw new Error('Value not resolved');
        return this._value;
    }

    async dereference(resolver: (url: string) => Promise<T>): Promise<void> {
        if (!this._value) {
            this._value = await resolver(this.reference);
        }
    }
}

export class ResolvableAndAdaptable<S, T> {
    constructor(
        public reference: string,
        private readonly adapter: (schema: S) => T,
        private _value?: T
    ) {}

    get isResolved(): boolean {
        return !!this._value;
    }

    get value(): T {
        if (!this._value) throw new Error('Value not resolved');
        return this._value;
    }

    async dereference(resolver: (url: string) => Promise<S>): Promise<void> {
        if (!this._value) {
            const schema = await resolver(this.reference);
            this._value = this.adapter(schema);
        }
    }
}
