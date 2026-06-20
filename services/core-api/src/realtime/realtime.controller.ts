import { Controller, ForbiddenException, Req, Sse, UseGuards, type MessageEvent } from "@nestjs/common";
import { map, type Observable } from "rxjs";
import { RealtimeService } from "./realtime.service";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";

@Controller("realtime")
@UseGuards(AuthGuard)
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  /**
   * Live event stream (Server-Sent Events), scoped to the authenticated session's tenant.
   * The browser's EventSource sends the session cookie automatically; AuthGuard resolves it.
   */
  @Sse("stream")
  stream(@Req() req: AuthedRequest): Observable<MessageEvent> {
    const tenantId = req.user.tenantId;
    if (!tenantId) throw new ForbiddenException("no_tenant");
    return this.realtime.stream(tenantId).pipe(
      map((event): MessageEvent => ({ data: event, type: event.type })),
    );
  }
}
