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
exports.TenantDataController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const page_query_dto_1 = require("../common/dto/page-query.dto");
const audit_service_1 = require("../audit/audit.service");
const tenant_data_service_1 = require("./tenant-data.service");
class ReplyDto {
    text;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], ReplyDto.prototype, "text", void 0);
class ConsentDto {
    purpose;
    granted;
    source;
}
__decorate([
    (0, class_validator_1.IsIn)(["marketing", "ai", "analytics"]),
    __metadata("design:type", String)
], ConsentDto.prototype, "purpose", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ConsentDto.prototype, "granted", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], ConsentDto.prototype, "source", void 0);
let TenantDataController = class TenantDataController {
    data;
    audit;
    constructor(data, audit) {
        this.data = data;
        this.audit = audit;
    }
    customers(req, q) {
        return this.data.customers(req.rls, q.limit, q.cursor);
    }
    customer(req, id) {
        return this.data.customerDetail(req.rls, id);
    }
    messages(req, id, q) {
        return this.data.messages(req.rls, id, q.limit);
    }
    reply(req, id, body) {
        return this.data.sendReply(req.rls, id, body.text);
    }
    read(req, id) {
        return this.data.markRead(req.rls, id);
    }
    listConsent(req, id) {
        return this.data.listConsent(req.rls, id);
    }
    setConsent(req, id, body) {
        return this.data.setConsent(req.rls, id, body);
    }
    exportCustomer(req, id) {
        return this.data.exportCustomer(req.rls, id);
    }
    async deleteCustomer(req, id) {
        const res = await this.data.deleteCustomer(req.rls, id);
        await this.audit.record({ actorUserId: req.user?.id, tenantId: req.user?.tenantId ?? null, action: "customer.delete", target: id });
        return res;
    }
    products(req) {
        return this.data.products(req.rls);
    }
    transactions(req, q) {
        return this.data.transactions(req.rls, q.limit, q.cursor);
    }
    inbox(req, q) {
        return this.data.inbox(req.rls, q.limit);
    }
    usage(req) {
        return this.data.usage(req.rls);
    }
    summary(req) {
        return this.data.dashboardSummary(req.rls);
    }
};
exports.TenantDataController = TenantDataController;
__decorate([
    (0, common_1.Get)("customers"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, page_query_dto_1.PageQueryDto]),
    __metadata("design:returntype", void 0)
], TenantDataController.prototype, "customers", null);
__decorate([
    (0, common_1.Get)("customers/:id"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TenantDataController.prototype, "customer", null);
__decorate([
    (0, common_1.Get)("customers/:id/messages"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, page_query_dto_1.PageQueryDto]),
    __metadata("design:returntype", void 0)
], TenantDataController.prototype, "messages", null);
__decorate([
    (0, common_1.Post)("customers/:id/reply"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ReplyDto]),
    __metadata("design:returntype", void 0)
], TenantDataController.prototype, "reply", null);
__decorate([
    (0, common_1.Post)("customers/:id/read"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TenantDataController.prototype, "read", null);
__decorate([
    (0, common_1.Get)("customers/:id/consent"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TenantDataController.prototype, "listConsent", null);
__decorate([
    (0, common_1.Post)("customers/:id/consent"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ConsentDto]),
    __metadata("design:returntype", void 0)
], TenantDataController.prototype, "setConsent", null);
__decorate([
    (0, common_1.Get)("customers/:id/export"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TenantDataController.prototype, "exportCustomer", null);
__decorate([
    (0, common_1.Delete)("customers/:id"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TenantDataController.prototype, "deleteCustomer", null);
__decorate([
    (0, common_1.Get)("products"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TenantDataController.prototype, "products", null);
__decorate([
    (0, common_1.Get)("transactions"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, page_query_dto_1.PageQueryDto]),
    __metadata("design:returntype", void 0)
], TenantDataController.prototype, "transactions", null);
__decorate([
    (0, common_1.Get)("inbox"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, page_query_dto_1.PageQueryDto]),
    __metadata("design:returntype", void 0)
], TenantDataController.prototype, "inbox", null);
__decorate([
    (0, common_1.Get)("usage"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TenantDataController.prototype, "usage", null);
__decorate([
    (0, common_1.Get)("dashboard/summary"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TenantDataController.prototype, "summary", null);
exports.TenantDataController = TenantDataController = __decorate([
    (0, swagger_1.ApiTags)("tenant"),
    (0, swagger_1.ApiCookieAuth)(),
    (0, common_1.Controller)("v1"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [tenant_data_service_1.TenantDataService, audit_service_1.AuditService])
], TenantDataController);
//# sourceMappingURL=tenant-data.controller.js.map