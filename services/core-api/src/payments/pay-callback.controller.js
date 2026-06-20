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
exports.PayCallbackController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const config_module_1 = require("../config/config.module");
const payments_service_1 = require("./payments.service");
// Public gateway return URL — every redirect gateway sends the customer's browser back here.
let PayCallbackController = class PayCallbackController {
    payments;
    config;
    constructor(payments, config) {
        this.payments = payments;
        this.config = config;
    }
    async callback(transactionId, query, reply) {
        const result = await this.payments.gatewayCallback(transactionId, query ?? {});
        const url = `${this.config.PUBLIC_BASE_URL}/pay/result?status=${result.ok ? "ok" : "failed"}&tx=${transactionId}`;
        await reply.header("location", url).code(302).send();
    }
};
exports.PayCallbackController = PayCallbackController;
__decorate([
    (0, common_1.Get)("callback/:transactionId"),
    __param(0, (0, common_1.Param)("transactionId")),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], PayCallbackController.prototype, "callback", null);
exports.PayCallbackController = PayCallbackController = __decorate([
    (0, swagger_1.ApiExcludeController)(),
    (0, common_1.Controller)("pay"),
    __param(1, (0, common_1.Inject)(config_module_1.APP_CONFIG)),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService, Object])
], PayCallbackController);
//# sourceMappingURL=pay-callback.controller.js.map