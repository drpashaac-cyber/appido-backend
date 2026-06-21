import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Me } from "@appido/types";
import type { AuthedRequest } from "./auth.guard";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Me => ctx.switchToHttp().getRequest<AuthedRequest>().user,
);
