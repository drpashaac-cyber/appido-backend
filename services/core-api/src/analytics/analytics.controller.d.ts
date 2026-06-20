import { type DbHandle } from "@appido/db";
import { TrackDto } from "../common/dto/track.dto";
export declare class AnalyticsController {
    private readonly dbh;
    constructor(dbh: DbHandle);
    /** Public funnel event from the landing page (not tenant-scoped). */
    track(body: TrackDto): Promise<{
        ok: true;
    }>;
}
