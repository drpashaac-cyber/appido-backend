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
exports.AnalyticsController = void 0;
const csrf_constants_1 = require("../security/csrf.constants");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const db_1 = require("@appido/db");
const db_module_1 = require("../db/db.module");
const track_dto_1 = require("../common/dto/track.dto");
let AnalyticsController = class AnalyticsController {
    dbh;
    constructor(dbh) {
        this.dbh = dbh;
    }
    /** Public funnel event from the landing page (not tenant-scoped). */
    async track(body) {
        await this.dbh.db.insert(db_1.schema.analyticsEvents).values({
            name: body.name,
            anonId: body.anonId,
            props: (body.props ?? null),
        });
        return { ok: true };
    }
};
exports.AnalyticsController = AnalyticsController;
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 60 } }),
    (0, csrf_constants_1.SkipCsrf)(),
    (0, common_1.Post)("track"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [track_dto_1.TrackDto]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "track", null);
exports.AnalyticsController = AnalyticsController = __decorate([
    (0, swagger_1.ApiTags)("analytics"),
    (0, common_1.Controller)("api"),
    __param(0, (0, common_1.Inject)(db_module_1.DB)),
    __metadata("design:paramtypes", [Object])
], AnalyticsController);
//# sourceMappingURL=analytics.controller.js.map