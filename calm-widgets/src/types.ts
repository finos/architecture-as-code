export interface CalmWidget<
    TContext = unknown,
    TOptions = Record<string, unknown>,
    TViewModel = unknown
> {
    id: string;
    templatePartial: string;
    partials?: string[];

    registerHelpers?: () => Record<string, (...args: unknown[]) => unknown>;

    transformToViewModel?: (
        context: TContext,
        options?: { hash?: TOptions }
    ) => TViewModel;

    validateContext: (context: unknown) => context is TContext;
}
