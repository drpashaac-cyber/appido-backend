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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeService = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const redis_module_1 = require("../redis/redis.module");
const CHANNEL_PREFIX = "rt:";
/**
 * Live data backbone. publish() fans out across all API instances via Redis
 * pub/sub; stream() returns a per-connection Observable scoped to one tenant.
 * Events get published by each domain as it ships (messages P3, usage P4, payments P5).
 */
let RealtimeService = class RealtimeService {
    redis;
    sub;
    subjects = new Map();
    constructor(redis, sub) {
        this.redis = redis;
        this.sub = sub;
    }
    onModuleInit() {
        void this.sub.psubscribe(`${CHANNEL_PREFIX}*`);
        this.sub.on("pmessage", (_pattern, channel, message) => {
            const tenantId = channel.slice(CHANNEL_PREFIX.length);
            const listeners = this.subjects.get(tenantId);
            if (!listeners?.size)
                return;
            let event;
            try {
                event = JSON.parse(message);
            }
            catch {
                return;
            }
            for (const s of listeners)
                s.next(event);
        });
    }
    async publish(event) {
        await this.redis.publish(`${CHANNEL_PREFIX}${event.tenantId}`, JSON.stringify(event));
    }
    stream(tenantId) {
        const subject = new rxjs_1.Subject();
        const set = this.subjects.get(tenantId) ?? new Set();
        set.add(subject);
        this.subjects.set(tenantId, set);
        return new rxjs_1.Observable((subscriber) => {
            const sub = subject.subscribe(subscriber);
            return () => {
                sub.unsubscribe();
                set.delete(subject);
                if (set.size === 0)
                    this.subjects.delete(tenantId);
            };
        });
    }
};
exports.RealtimeService = RealtimeService;
exports.RealtimeService = RealtimeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_module_1.REDIS)),
    __param(1, (0, common_1.Inject)(redis_module_1.REDIS_SUB)),
    __metadata("design:paramtypes", [Function, Function])
], RealtimeService);
//# sourceMappingURL=realtime.service.js.map