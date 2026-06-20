import { ScriptService } from "./script.service";
export declare class ScriptController {
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
}
