import { SetMetadata } from "@nestjs/common";

export const CSRF_COOKIE = "appido_csrf";
export const SKIP_CSRF = "skipCsrf";

/** Mark a route/controller exempt from CSRF (public, non-cookie endpoints). */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF, true);
