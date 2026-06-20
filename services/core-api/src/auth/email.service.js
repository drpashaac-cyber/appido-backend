"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResendEmailService = exports.ConsoleEmailService = exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
class EmailService {
}
exports.EmailService = EmailService;
/** Dev transport — logs the code. Used when RESEND_API_KEY is unset. */
let ConsoleEmailService = class ConsoleEmailService extends EmailService {
    log = new common_1.Logger("Email");
    async sendLoginCode(to, code, purpose) {
        this.log.warn(`[dev email] ${purpose} code for ${to}: ${code}`);
    }
};
exports.ConsoleEmailService = ConsoleEmailService;
exports.ConsoleEmailService = ConsoleEmailService = __decorate([
    (0, common_1.Injectable)()
], ConsoleEmailService);
/** Production transport — sends via Resend's HTTP API (no extra dependency). */
class ResendEmailService extends EmailService {
    config;
    log = new common_1.Logger("Email");
    constructor(config) {
        super();
        this.config = config;
    }
    async sendLoginCode(to, code, purpose) {
        const apiKey = this.config.RESEND_API_KEY;
        if (!apiKey) {
            this.log.warn(`[email] RESEND_API_KEY unset; ${purpose} code for ${to} not sent`);
            return;
        }
        const subject = purpose === "reset" ? "Reset your APPIDO password" : purpose === "twofa" ? "Your APPIDO verification code" : "Your APPIDO login code";
        const label = purpose === "reset" ? "password reset" : purpose === "twofa" ? "verification" : "login";
        const text = `Your ${label} code is ${code}. It expires shortly. If you didn't request this, you can ignore this email.`;
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
            body: JSON.stringify({ from: this.config.EMAIL_FROM, to, subject, text }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            this.log.error(`[email] resend failed ${res.status}: ${body.slice(0, 200)}`);
            throw new Error(`email_send_failed_${res.status}`);
        }
    }
}
exports.ResendEmailService = ResendEmailService;
//# sourceMappingURL=email.service.js.map