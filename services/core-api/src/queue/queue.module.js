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
exports.QueueModule = exports.GROWTH_QUEUE = exports.TG_INGEST_QUEUE = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const config_module_1 = require("../config/config.module");
exports.TG_INGEST_QUEUE = Symbol("TG_INGEST_QUEUE");
exports.GROWTH_QUEUE = Symbol("GROWTH_QUEUE");
let QueueModule = class QueueModule {
    tgQueue;
    growthQueue;
    constructor(tgQueue, growthQueue) {
        this.tgQueue = tgQueue;
        this.growthQueue = growthQueue;
    }
    async onModuleDestroy() {
        await this.tgQueue.close();
        await this.growthQueue.close();
    }
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            {
                provide: exports.TG_INGEST_QUEUE,
                inject: [config_module_1.APP_CONFIG],
                useFactory: (config) => new bullmq_1.Queue("tg-ingest", {
                    connection: new ioredis_1.default(config.REDIS_URL, { maxRetriesPerRequest: null }),
                    defaultJobOptions: { attempts: 5, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 1000, removeOnFail: 5000 },
                }),
            },
            {
                provide: exports.GROWTH_QUEUE,
                inject: [config_module_1.APP_CONFIG],
                useFactory: (config) => new bullmq_1.Queue("growth", {
                    connection: new ioredis_1.default(config.REDIS_URL, { maxRetriesPerRequest: null }),
                    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 500, removeOnFail: 1000 },
                }),
            },
        ],
        exports: [exports.TG_INGEST_QUEUE, exports.GROWTH_QUEUE],
    }),
    __param(0, (0, common_1.Inject)(exports.TG_INGEST_QUEUE)),
    __param(1, (0, common_1.Inject)(exports.GROWTH_QUEUE)),
    __metadata("design:paramtypes", [bullmq_1.Queue,
        bullmq_1.Queue])
], QueueModule);
//# sourceMappingURL=queue.module.js.map