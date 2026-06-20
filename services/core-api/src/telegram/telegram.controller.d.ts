import { type AuthedRequest } from "../auth/auth.guard";
import { TelegramService } from "./telegram.service";
declare class VerifyTokenDto {
    token: string;
}
declare class ConnectDto {
    token: string;
    name?: string;
}
export declare class TelegramController {
    private readonly tg;
    constructor(tg: TelegramService);
    verify(body: VerifyTokenDto): Promise<{
        botId: number;
        username?: string;
        firstName?: string;
    }>;
    connect(req: AuthedRequest, body: ConnectDto): Promise<{
        channelId: string;
        webhookUrl: string;
        ok: boolean;
        botUsername: string;
    }>;
    status(req: AuthedRequest, channelId: string): Promise<{
        url: string;
        pendingUpdates: number;
        lastError: string;
    }>;
    disconnect(req: AuthedRequest, channelId: string): Promise<{
        ok: true;
    }>;
}
export {};
