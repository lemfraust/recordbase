export type ExecutorRetry = { state: any; };

export type ExecutorFailure = { error: unknown; };

export type ExecutorResult = ExecutorRetry | ExecutorFailure | undefined;

export type ExecutorHandler = (error: unknown, state?: any) => Promise<ExecutorResult> | ExecutorResult;

export const pause: (ms: number) => Promise<void> = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const retryHandler = (options: {
    attempts: number,
    wait?: number,
    onAttempt?: (error: unknown, attempt: number, final: boolean) => void | unknown;
}) => {
    const { attempts, wait, onAttempt } = options;

    if (attempts < 1)
        throw new Error('Attempts must be at least 1');

    return async (error: unknown, state: number = 0) => {
        const final = state >= attempts - 1;

        const result = onAttempt?.(error, state, final);

        if (result !== undefined)
            return { error: result };

        if (final)
            return undefined;

        if (wait)
            await pause(wait);

        return { state: state + 1 };
    };
};

export const execute = async <T>(func: () => Promise<T>, handler?: ExecutorHandler): Promise<T> => {
    let state: any = undefined;

    while (true) {
        try {
            return await func();
        }
        catch (error) {
            const result = await handler?.(error, state);

            if (result) {
                if ('state' in result)
                    state = result.state;
                else if ('error' in result)
                    throw result.error;
            }
            else {
                throw error;
            }
        }
    }
};