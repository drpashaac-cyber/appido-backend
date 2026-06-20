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
exports.AiPublicController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const throttler_1 = require("@nestjs/throttler");
const swagger_1 = require("@nestjs/swagger");
const ai_service_1 = require("./ai.service");
class PublicAdvisorDto {
    question;
    lang;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], PublicAdvisorDto.prototype, "question", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["en", "fa", "ar", "tr", "ru"]),
    __metadata("design:type", String)
], PublicAdvisorDto.prototype, "lang", void 0);
// Public — no auth, no tenant. Powers the landing support widget. Throttled to limit cost/abuse.
let AiPublicController = class AiPublicController {
    ai;
    constructor(ai) {
        this.ai = ai;
    }
    advisor(body) {
        return this.ai.advisorPublic(body.question, body.lang);
    }
};
exports.AiPublicController = AiPublicController;
__decorate([
    (0, common_1.Post)("advisor-public"),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 20 } }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PublicAdvisorDto]),
    __metadata("design:returntype", void 0)
], AiPublicController.prototype, "advisor", null);
exports.AiPublicController = AiPublicController = __decorate([
    (0, swagger_1.ApiTags)("ai"),
    (0, common_1.Controller)("v1/ai"),
    __metadata("design:paramtypes", [ai_service_1.AiService])
], AiPublicController);
//# sourceMappingURL=ai-public.controller.js.map