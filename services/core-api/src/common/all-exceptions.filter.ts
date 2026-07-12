import {
  type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { captureException } from "../observability/sentry";

/** Consistent error envelope: { ok:false, error, statusCode } — matches ApiResult. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger("Exception");

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : "internal_error";
    const error =
      typeof body === "string" ? body : ((body as { message?: unknown }).message ?? "error");
    if (status >= 500) {
      captureException(exception);
      this.log.error(exception instanceof Error ? exception.stack : String(exception));
    }
    void reply.status(status).send({ ok: false, error, statusCode: status });
  }
}
