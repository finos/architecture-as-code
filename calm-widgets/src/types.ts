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
        options?: TOptions
    ) => TViewModel;

    validateContext: (
        context: unknown,
        options?: TOptions
    ) => context is TContext;
}
