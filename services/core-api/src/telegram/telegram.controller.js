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
exports.TelegramController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const telegram_1 = require("@appido/telegram");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const telegram_service_1 = require("./telegram.service");
class VerifyTokenDto {
    token;
}
__decorate([
    (0, class_validator_1.Matches)(telegram_1.BOT_TOKEN_RE, { message: "invalid bot token format" }),
    __metadata("design:type", String)
], VerifyTokenDto.prototype, "token", void 0);
class ConnectDto {
    token;
    name;
}
__decorate([
    (0, class_validator_1.Matches)(telegram_1.BOT_TOKEN_RE, { message: "invalid bot token format" }),
    __metadata("design:type", String)
], ConnectDto.prototype, "token", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ConnectDto.prototype, "name", void 0);
let TelegramController = class TelegramController {
    tg;
    constructor(tg) {
        this.tg = tg;
    }
    verify(body) {
        return this.tg.verifyToken(body.token);
    }
    connect(req, body) {
        return this.tg.connect(req.rls, req.user.id, body);
    }
    status(req, channelId) {
        return this.tg.status(req.rls, channelId);
    }
    disconnect(req, channelId) {
        return this.tg.disconnect(req.rls, req.user.id, channelId);
    }
};
exports.TelegramController = TelegramController;
__decorate([
    (0, common_1.Post)("verify-token"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [VerifyTokenDto]),
    __metadata("design:returntype", void 0)
], TelegramController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)("connect"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ConnectDto]),
    __metadata("design:returntype", void 0)
], TelegramController.prototype, "connect", null);
__decorate([
    (0, common_1.Get)("status/:channelId"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("channelId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TelegramController.prototype, "status", null);
__decorate([
    (0, common_1.Post)("disconnect/:channelId"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("channelId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TelegramController.prototype, "disconnect", null);
exports.TelegramController = TelegramController = __decorate([
    (0, swagger_1.ApiTags)("telegram"),
    (0, swagger_1.ApiCookieAuth)(),
    (0, common_1.Controller)("v1/telegram"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("tenant_admin"),
    __metadata("design:paramtypes", [telegram_service_1.TelegramService])
], TelegramController);
//# sourceMappingURL=telegram.controller.js.map