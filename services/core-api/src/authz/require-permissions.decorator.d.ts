import type { Permission } from "@appido/authz";
export declare const PERMISSIONS_KEY = "permissions";
export declare const RequirePermissions: (...perms: Permission[]) => import("@nestjs/common").CustomDecorator<string>;
