export declare function sha256(value: string): string;
export declare function newSessionToken(): {
    token: string;
    tokenHash: string;
};
/** 6-digit numeric one-time code (English digits). */
export declare function newNumericCode(): string;
