/** Argon2id password hashing (prebuilt binaries, no node-gyp). */
export declare class PasswordService {
    hash(password: string): Promise<string>;
    verify(passwordHash: string, password: string): Promise<boolean>;
}
