import { type AuthedRequest } from "../auth/auth.guard";
import { FlywheelService } from "./flywheel.service";
export declare class FlywheelController {
    private readonly flywheel;
    constructor(flywheel: FlywheelService);
    stats(req: AuthedRequest): Promise<import("@appido/ai").TaskOutcomeStat[]>;
}
