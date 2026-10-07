export class EvaluationClientError extends Error {
    readonly status: number;
    readonly code: string | undefined;

    constructor(status: number, message: string, code?: string) {
        super(message);
        this.name = "EvaluationClientError";
        this.status = status;
        this.code = code;
    }
}
