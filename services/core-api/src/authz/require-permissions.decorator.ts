import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@appido/authz";

export const PERMISSIONS_KEY = "permissions";
export const RequirePermissions = (...perms: Permission[]) => SetMetadata(PERMISSIONS_KEY, perms);
