export interface CalmModelVisitor {
    visit(obj: unknown, path?: string[]): Promise<void>;
}
