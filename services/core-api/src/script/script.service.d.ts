import { type DbHandle } from "@appido/db";
export interface ScriptInput {
    key?: string;
    category?: string;
    questionFa?: string;
    questionEn?: string;
    sortOrder?: number;
    enabled?: boolean;
}
export declare class ScriptService {
    private readonly dbh;
    constructor(dbh: DbHandle);
    private slug;
    /** Active + enabled, ordered — for the AI worker and the tenant read. */
    listActive(): Promise<{
        enabled: boolean;
        id: string;
        createdAt: Date;
        active: boolean;
        key: string;
        updatedAt: Date;
        sortOrder: number;
        category: string;
        questionFa: string;
        questionEn: string;
    }[]>;
    /** All non-deleted rows (enabled + paused) — for the owner console. */
    listAll(): Promise<{
        enabled: boolean;
        id: string;
        createdAt: Date;
        active: boolean;
        key: string;
        updatedAt: Date;
        sortOrder: number;
        category: string;
        questionFa: string;
        questionEn: string;
    }[]>;
    create(input: ScriptInput): Promise<{
        enabled: boolean;
        id: string;
        createdAt: Date;
        active: boolean;
        key: string;
        updatedAt: Date;
        sortOrder: number;
        category: string;
        questionFa: string;
        questionEn: string;
    }>;
    update(id: string, patch: ScriptInput): Promise<{
        id: string;
        key: string;
        category: string;
        questionFa: string;
        questionEn: string;
        sortOrder: number;
        enabled: boolean;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: string): Promise<{
        ok: true;
    }>;
}
