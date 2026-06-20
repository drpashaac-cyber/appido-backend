import { Injectable } from "@nestjs/common";
import { hash, verify } from "@node-rs/argon2";

/** Argon2id password hashing (prebuilt binaries, no node-gyp). */
@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return hash(password);
  }
  verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }
}
