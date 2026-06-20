"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const script_admin_controller_1 = require("./script-admin.controller");
const script_controller_1 = require("./script.controller");
const script_service_1 = require("./script.service");
let ScriptModule = class ScriptModule {
};
exports.ScriptModule = ScriptModule;
exports.ScriptModule = ScriptModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule],
        controllers: [script_controller_1.ScriptController, script_admin_controller_1.ScriptAdminController],
        providers: [script_service_1.ScriptService],
        exports: [script_service_1.ScriptService],
    })
], ScriptModule);
//# sourceMappingURL=script.module.js.map