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
exports.DbModule = exports.DB = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@appido/db");
const config_module_1 = require("../config/config.module");
exports.DB = Symbol("DB");
let DbModule = class DbModule {
    handle;
    constructor(handle) {
        this.handle = handle;
    }
    async onModuleDestroy() {
        await this.handle.pool.end();
    }
};
exports.DbModule = DbModule;
exports.DbModule = DbModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            {
                provide: exports.DB,
                inject: [config_module_1.APP_CONFIG],
                useFactory: (config) => (0, db_1.createDb)(config.DATABASE_URL),
            },
        ],
        exports: [exports.DB],
    }),
    __param(0, (0, common_1.Inject)(exports.DB)),
    __metadata("design:paramtypes", [Object])
], DbModule);
//# sourceMappingURL=db.module.js.map