import { ScriptService } from "./script.service";
declare class ScriptDto {
    key?: string;
    category?: string;
    questionFa?: string;
    questionEn?: string;
    sortOrder?: number;
    enabled?: boolean;
}
export declare class ScriptAdminController {
    private readonly script;
    constructor(script: ScriptService);
    list(): Promise<{
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
    create(body: ScriptDto): Promise<{
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
    update(id: string, body: ScriptDto): Promise<{
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
export {};
