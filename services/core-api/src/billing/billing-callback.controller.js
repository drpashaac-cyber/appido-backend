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
exports.BillingCallbackController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const config_module_1 = require("../config/config.module");
const billing_service_1 = require("./billing.service");
// Public gateway return URL for an Appido subscription payment.
let BillingCallbackController = class BillingCallbackController {
    billing;
    config;
    constructor(billing, config) {
        this.billing = billing;
        this.config = config;
    }
    async callback(subscriptionId, authority, status, reply) {
        const result = await this.billing.zarinpalCallback(subscriptionId, authority ?? "", status ?? "");
        const url = `${this.config.PUBLIC_BASE_URL}/billing/result?status=${result.ok ? "ok" : "failed"}&sub=${subscriptionId}`;
        await reply.header("location", url).code(302).send();
    }
};
exports.BillingCallbackController = BillingCallbackController;
__decorate([
    (0, common_1.Get)("callback/:subscriptionId"),
    __param(0, (0, common_1.Param)("subscriptionId")),
    __param(1, (0, common_1.Query)("Authority")),
    __param(2, (0, common_1.Query)("Status")),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], BillingCallbackController.prototype, "callback", null);
exports.BillingCallbackController = BillingCallbackController = __decorate([
    (0, swagger_1.ApiExcludeController)(),
    (0, common_1.Controller)("billing"),
    __param(1, (0, common_1.Inject)(config_module_1.APP_CONFIG)),
    __metadata("design:paramtypes", [billing_service_1.BillingService, Object])
], BillingCallbackController);
//# sourceMappingURL=billing-callback.controller.js.map