import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PlansService } from "./plans.service";

// Public — the landing page and dashboard read the live plan catalog from here. No auth, no secrets.
@ApiTags("plans")
@Controller("v1/plans")
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list() {
    return this.plans.listPublic();
  }
}
