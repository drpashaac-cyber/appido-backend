"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoModule = exports.SECRET_CIPHER = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("@appido/crypto");
const config_module_1 = require("../config/config.module");
exports.SECRET_CIPHER = Symbol("SECRET_CIPHER");
let CryptoModule = class CryptoModule {
};
exports.CryptoModule = CryptoModule;
exports.CryptoModule = CryptoModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            {
                provide: exports.SECRET_CIPHER,
                inject: [config_module_1.APP_CONFIG],
                useFactory: (config) => {
                    const keys = (0, crypto_1.buildKeyList)(config.SECRETS_MASTER_KEY, config.SECRETS_MASTER_KEYS);
                    if (keys.length === 0)
                        throw new Error("SECRETS_MASTER_KEY is required to encrypt secrets");
                    return new crypto_1.SecretCipher(keys);
                },
            },
        ],
        exports: [exports.SECRET_CIPHER],
    })
], CryptoModule);
//# sourceMappingURL=crypto.module.js.map