import { type MessageEvent } from "@nestjs/common";
import { type Observable } from "rxjs";
import { RealtimeService } from "./realtime.service";
import { type AuthedRequest } from "../auth/auth.guard";
export declare class RealtimeController {
    private readonly realtime;
    constructor(realtime: RealtimeService);
    /**
     * Live event stream (Server-Sent Events), scoped to the authenticated session's tenant.
     * The browser's EventSource sends the session cookie automatically; AuthGuard resolves it.
     */
    stream(req: AuthedRequest): Observable<MessageEvent>;
}
