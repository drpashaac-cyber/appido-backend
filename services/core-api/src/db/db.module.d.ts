import { type OnModuleDestroy } from "@nestjs/common";
import { type DbHandle } from "@appido/db";
export declare const DB: unique symbol;
export declare class DbModule implements OnModuleDestroy {
    private readonly handle;
    constructor(handle: DbHandle);
    onModuleDestroy(): Promise<void>;
}
