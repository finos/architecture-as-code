/** A failure that the lens shows to the user, as application/problem+json. */
export class Problem extends Error {
    constructor(readonly status: number, readonly title: string, readonly detail?: string) {
        super(detail ? `${title}: ${detail}` : title);
    }
}
