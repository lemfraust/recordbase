export type ResultSuccess<Value> = { success: true; value: Value; };

export type ResultFailure<Info> = { success: false; info: Info; };

export type Result<Value, Info> = ResultSuccess<Value> | ResultFailure<Info>;

export class ResultError<Info> extends Error { constructor(message: string, public readonly info: Info) { super(message); } }

export const Result = Object.freeze({
    success: <Value>(value: Value): ResultSuccess<Value> => ({ success: true, value }),
    failure: <Info>(info: Info): ResultFailure<Info> => ({ success: false, info }),
    ensure: <Value, Info>(result: Result<Value, Info>, message?: string): Value => {
        if (!result.success) throw new ResultError(message ?? 'Result is not successful', result.info);
        return result.value;
    }
});