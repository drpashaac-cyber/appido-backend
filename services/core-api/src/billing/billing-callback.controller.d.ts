import type { FastifyReply } from "fastify";
import type { AppConfig } from "@appido/config";
import { BillingService } from "./billing.service";
export declare class BillingCallbackController {
    private readonly billing;
    private readonly config;
    constructor(billing: BillingService, config: AppConfig);
    callback(subscriptionId: string, authority: string, status: string, reply: FastifyReply): Promise<void>;
}
