export type RecordIssue = {
    message: string;
};

export const RecordIssue = Object.freeze({
    missingField: (name: string): RecordIssue =>
        ({ message: `Missing required field '${name}'` }),

    nullField: (name: string): RecordIssue =>
        ({ message: `Null value for required field '${name}'` }),

    validationFailed: (name: string, info: string): RecordIssue =>
        ({ message: `Failed to validate field '${name}': ${info}` }),

    parsingFailed: (name: string, info: string): RecordIssue =>
        ({ message: `Failed to parse field '${name}': ${info}` }),

    missingGroup: (name: string): RecordIssue =>
        ({ message: `Missing required group '${name}'` }),

    expectedGroupObject: (name: string): RecordIssue =>
        ({ message: `Expected group '${name}' to be an object` }),
});