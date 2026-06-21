import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from "class-validator";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { registeredMethods } from "@appido/payments";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { PaymentsService } from "./payments.service";

// Valid methods come from the payments registry — add a gateway there and it's accepted here too.
class CredentialDto {
  @IsIn(registeredMethods()) @IsString() method!: string;
  @IsIn(["key", "wallet", "manual"]) kind!: "key" | "wallet" | "manual";
  @IsOptional() @IsObject() secret?: Record<string, unknown>;
}
class EnabledDto {
  @IsBoolean() enabled!: boolean;
}

@ApiTags("payments")
@ApiCookieAuth()
@Controller("v1/payments")
@UseGuards(AuthGuard, RolesGuard)
@Roles("tenant_admin")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Gateway catalog (incl. "coming soon", with platform policy applied) — the dashboard renders its grid from this. */
  @Get("methods")
  methods() {
    return this.payments.catalogWithPolicy();
  }

  @Get("credentials")
  list(@Req() req: AuthedRequest) {
    return this.payments.listCredentials(req.rls);
  }

  @Post("credentials")
  upsert(@Req() req: AuthedRequest, @Body() body: CredentialDto) {
    return this.payments.upsertCredential(req.rls, body);
  }

  @Patch("credentials/:id")
  setEnabled(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: EnabledDto) {
    return this.payments.setEnabled(req.rls, id, body.enabled);
  }

  @Delete("credentials/:id")
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.payments.deleteCredential(req.rls, id);
  }

  @Post("transactions/:id/confirm")
  confirm(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.payments.confirmManual(req.rls, id);
  }
}
