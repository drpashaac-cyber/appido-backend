import { Injectable, Logger } from "@nestjs/common";
import type { AppConfig } from "@appido/config";

export abstract class EmailService {
  abstract sendLoginCode(to: string, code: string, purpose: "login" | "twofa" | "reset"): Promise<void>;
}

/** Dev transport — logs the code. Used when RESEND_API_KEY is unset. */
@Injectable()
export class ConsoleEmailService extends EmailService {
  private readonly log = new Logger("Email");
  async sendLoginCode(to: string, code: string, purpose: "login" | "twofa" | "reset"): Promise<void> {
    this.log.warn(`[dev email] ${purpose} code for ${to}: ${code}`);
  }
}

/** Production transport — sends via Resend's HTTP API (no extra dependency). */
export class ResendEmailService extends EmailService {
  private readonly log = new Logger("Email");
  constructor(private readonly config: AppConfig) {
    super();
  }
  async sendLoginCode(to: string, code: string, purpose: "login" | "twofa" | "reset"): Promise<void> {
    const apiKey = this.config.RESEND_API_KEY;
    if (!apiKey) {
      this.log.warn(`[email] RESEND_API_KEY unset; ${purpose} code for ${to} not sent`);
      return;
    }
    const subject =
      purpose === "reset" ? "Reset your APPIDO password" : purpose === "twofa" ? "Your APPIDO verification code" : "Your APPIDO login code";
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
