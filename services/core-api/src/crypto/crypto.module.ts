import { Global, Module } from "@nestjs/common";
import { SecretCipher, buildKeyList } from "@appido/crypto";
import type { AppConfig } from "@appido/config";
import { APP_CONFIG } from "../config/config.module";

export const SECRET_CIPHER = Symbol("SECRET_CIPHER");

@Global()
@Module({
  providers: [
    {
      provide: SECRET_CIPHER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): SecretCipher => {
        const keys = buildKeyList(config.SECRETS_MASTER_KEY, config.SECRETS_MASTER_KEYS);
        if (keys.length === 0) throw new Error("SECRETS_MASTER_KEY is required to encrypt secrets");
        return new SecretCipher(keys);
      },
    },
  ],
  exports: [SECRET_CIPHER],
})
export class CryptoModule {}
