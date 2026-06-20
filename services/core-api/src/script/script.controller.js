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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const script_service_1 = require("./script.service");
// Tenant (dashboard) — read the active onboarding script the AI will use.
let ScriptController = class ScriptController {
    script;
    constructor(script) {
        this.script = script;
    }
    list() {
        return this.script.listActive();
    }
};
exports.ScriptController = ScriptController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ScriptController.prototype, "list", null);
exports.ScriptController = ScriptController = __decorate([
    (0, swagger_1.ApiTags)("ai"),
    (0, swagger_1.ApiCookieAuth)(),
    (0, common_1.Controller)("v1/ai/script"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [script_service_1.ScriptService])
], ScriptController);
//# sourceMappingURL=script.controller.js.map