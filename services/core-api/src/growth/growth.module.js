"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrowthModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const ai_module_1 = require("../ai/ai.module");
const growth_controller_1 = require("./growth.controller");
const growth_service_1 = require("./growth.service");
let GrowthModule = class GrowthModule {
};
exports.GrowthModule = GrowthModule;
exports.GrowthModule = GrowthModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, ai_module_1.AiModule],
        controllers: [growth_controller_1.GrowthController],
        providers: [growth_service_1.GrowthService],
        exports: [growth_service_1.GrowthService],
    })
], GrowthModule);
//# sourceMappingURL=growth.module.js.map