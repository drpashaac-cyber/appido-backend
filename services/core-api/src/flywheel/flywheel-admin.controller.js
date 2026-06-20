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
exports.FlywheelAdminController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const permissions_guard_1 = require("../authz/permissions.guard");
const require_permissions_decorator_1 = require("../authz/require-permissions.decorator");
const flywheel_service_1 = require("./flywheel.service");
class GoldenDto {
    task;
    input;
    expected;
    note;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], GoldenDto.prototype, "task", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], GoldenDto.prototype, "input", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], GoldenDto.prototype, "expected", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GoldenDto.prototype, "note", void 0);
class RunEvalDto {
    task;
    model;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], RunEvalDto.prototype, "task", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], RunEvalDto.prototype, "model", void 0);
// Platform owner: manage golden regression sets + trigger/inspect evals.
let FlywheelAdminController = class FlywheelAdminController {
    flywheel;
    constructor(flywheel) {
        this.flywheel = flywheel;
    }
    listGolden(req, task) {
        return this.flywheel.listGolden(req.rls, task);
    }
    addGolden(req, body) {
        return this.flywheel.addGolden(req.rls, body);
    }
    listEvals(req) {
        return this.flywheel.listEvals(req.rls);
    }
    runEval(req, body) {
        return this.flywheel.enqueueEval(req.rls, body);
    }
};
exports.FlywheelAdminController = FlywheelAdminController;
__decorate([
    (0, common_1.Get)("golden-cases"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)("task")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FlywheelAdminController.prototype, "listGolden", null);
__decorate([
    (0, common_1.Post)("golden-cases"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GoldenDto]),
    __metadata("design:returntype", void 0)
], FlywheelAdminController.prototype, "addGolden", null);
__decorate([
    (0, common_1.Get)("evals"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FlywheelAdminController.prototype, "listEvals", null);
__decorate([
    (0, common_1.Post)("evals/run"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, RunEvalDto]),
    __metadata("design:returntype", void 0)
], FlywheelAdminController.prototype, "runEval", null);
exports.FlywheelAdminController = FlywheelAdminController = __decorate([
    (0, swagger_1.ApiTags)("owner-flywheel"),
    (0, swagger_1.ApiCookieAuth)(),
    (0, common_1.Controller)("v1/owner"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)("platform:overview"),
    __metadata("design:paramtypes", [flywheel_service_1.FlywheelService])
], FlywheelAdminController);
//# sourceMappingURL=flywheel-admin.controller.js.map