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
exports.RealtimeController = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const realtime_service_1 = require("./realtime.service");
const auth_guard_1 = require("../auth/auth.guard");
let RealtimeController = class RealtimeController {
    realtime;
    constructor(realtime) {
        this.realtime = realtime;
    }
    /**
     * Live event stream (Server-Sent Events), scoped to the authenticated session's tenant.
     * The browser's EventSource sends the session cookie automatically; AuthGuard resolves it.
     */
    stream(req) {
        const tenantId = req.user.tenantId;
        if (!tenantId)
            throw new common_1.ForbiddenException("no_tenant");
        return this.realtime.stream(tenantId).pipe((0, rxjs_1.map)((event) => ({ data: event, type: event.type })));
    }
};
exports.RealtimeController = RealtimeController;
__decorate([
    (0, common_1.Sse)("stream"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Function)
], RealtimeController.prototype, "stream", null);
exports.RealtimeController = RealtimeController = __decorate([
    (0, common_1.Controller)("realtime"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [realtime_service_1.RealtimeService])
], RealtimeController);
//# sourceMappingURL=realtime.controller.js.map