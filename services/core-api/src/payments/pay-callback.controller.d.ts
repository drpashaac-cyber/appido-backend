import type { FastifyReply } from "fastify";
import type { AppConfig } from "@appido/config";
import { PaymentsService } from "./payments.service";
export declare class PayCallbackController {
    private readonly payments;
    private readonly config;
    constructor(payments: PaymentsService, config: AppConfig);
    callback(transactionId: string, query: Record<string, string>, reply: FastifyReply): Promise<void>;
}
