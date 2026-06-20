import { PaymentsService } from "./payments.service";
declare class PolicyDto {
    enabled: boolean;
}
export declare class PaymentsAdminController {
    private readonly payments;
    constructor(payments: PaymentsService);
    list(): Promise<{
        method: string;
        label: string;
        group: import("@appido/payments").GatewayGroup;
        crypto: boolean;
        available: boolean;
        enabled: boolean;
    }[]>;
    set(method: string, body: PolicyDto): Promise<{
        method: string;
        enabled: boolean;
    }>;
}
export {};
