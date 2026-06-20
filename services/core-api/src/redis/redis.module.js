"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisModule = exports.REDIS_SUB = exports.REDIS = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
const config_module_1 = require("../config/config.module");
exports.REDIS = Symbol("REDIS");
exports.REDIS_SUB = Symbol("REDIS_SUB");
let RedisModule = class RedisModule {
    redis;
    sub;
    constructor(redis, sub) {
        this.redis = redis;
        this.sub = sub;
    }
    async onModuleDestroy() {
        this.redis.disconnect();
        this.sub.disconnect();
    }
};
exports.RedisModule = RedisModule;
exports.RedisModule = RedisModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            {
                provide: exports.REDIS,
                inject: [config_module_1.APP_CONFIG],
                useFactory: (config) => new ioredis_1.default(config.REDIS_URL, { maxRetriesPerRequest: null }),
            },
            {
                provide: exports.REDIS_SUB,
                inject: [config_module_1.APP_CONFIG],
                useFactory: (config) => new ioredis_1.default(config.REDIS_URL, { maxRetriesPerRequest: null }),
            },
        ],
        exports: [exports.REDIS, exports.REDIS_SUB],
    }),
    __param(0, (0, common_1.Inject)(exports.REDIS)),
    __param(1, (0, common_1.Inject)(exports.REDIS_SUB)),
    __metadata("design:paramtypes", [Function, Function])
], RedisModule);
//# sourceMappingURL=redis.module.js.map