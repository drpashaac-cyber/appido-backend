import { type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
/** Consistent error envelope: { ok:false, error, statusCode } — matches ApiResult. */
export declare class AllExceptionsFilter implements ExceptionFilter {
    private readonly log;
    catch(exception: unknown, host: ArgumentsHost): void;
}
