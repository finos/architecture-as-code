export interface CalmAdaptable<TSchema, TCanonicalSchema> {
    toSchema(): TSchema;
    toCanonicalSchema(): TCanonicalSchema;
}
export type NullSchema = unknown;
