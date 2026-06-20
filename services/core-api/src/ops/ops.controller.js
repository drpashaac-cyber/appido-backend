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
exports.OpsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const permissions_guard_1 = require("../authz/permissions.guard");
const require_permissions_decorator_1 = require("../authz/require-permissions.decorator");
const ops_service_1 = require("./ops.service");
// Platform ops: inspect/replay dead-lettered jobs, trigger secret-key rotation.
let OpsController = class OpsController {
    ops;
    constructor(ops) {
        this.ops = ops;
    }
    deadLetters(req) {
        return this.ops.listDeadLetters(req.rls);
    }
    replay(req, id) {
        return this.ops.replay(req.rls, id);
    }
    rotate(req) {
        return this.ops.rotateSecrets(req.rls);
    }
};
exports.OpsController = OpsController;
__decorate([
    (0, common_1.Get)("dead-letters"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "deadLetters", null);
__decorate([
    (0, common_1.Post)("dead-letters/:id/replay"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "replay", null);
__decorate([
    (0, common_1.Post)("secrets/rotate"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "rotate", null);
exports.OpsController = OpsController = __decorate([
    (0, swagger_1.ApiTags)("owner-ops"),
    (0, swagger_1.ApiCookieAuth)(),
    (0, common_1.Controller)("v1/owner"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)("platform:overview"),
    __metadata("design:paramtypes", [ops_service_1.OpsService])
], OpsController);
//# sourceMappingURL=ops.controller.js.map