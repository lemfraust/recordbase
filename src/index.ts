export * from './record';
export * from './util';
export * from './grid';

export * as rb from './helpers';


import { Result } from './util';

const log = (label: string, result: Result<any, any>, expected: boolean) => {
    const matched = result.success === expected;

    console.log(
        `\x1b[35m${label.padStart(35)}\x1b[0m  \x1b[40m` +
        (matched ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m') + '  ' +
        (result.success
            ? `\x1b[32msuccess:\x1b[0m \x1b[33m${result.value}\x1b[0m`
            : `\x1b[31mfailure:\x1b[0m \x1b[36m${result.info}\x1b[0m`)
    );
};
