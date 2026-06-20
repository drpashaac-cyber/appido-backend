"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const me_controller_1 = require("./me.controller");
const password_service_1 = require("./password.service");
const email_service_1 = require("./email.service");
const config_module_1 = require("../config/config.module");
const auth_guard_1 = require("./auth.guard");
const roles_guard_1 = require("./roles.guard");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        controllers: [auth_controller_1.AuthController, me_controller_1.MeController],
        providers: [
            auth_service_1.AuthService,
            password_service_1.PasswordService,
            { provide: email_service_1.EmailService, inject: [config_module_1.APP_CONFIG], useFactory: (cfg) => (cfg.RESEND_API_KEY ? new email_service_1.ResendEmailService(cfg) : new email_service_1.ConsoleEmailService()) },
            auth_guard_1.AuthGuard,
            roles_guard_1.RolesGuard,
        ],
        exports: [auth_service_1.AuthService, auth_guard_1.AuthGuard, roles_guard_1.RolesGuard],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map