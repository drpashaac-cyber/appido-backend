export declare const CSRF_COOKIE = "appido_csrf";
export declare const SKIP_CSRF = "skipCsrf";
/** Mark a route/controller exempt from CSRF (public, non-cookie endpoints). */
export declare const SkipCsrf: () => import("@nestjs/common").CustomDecorator<string>;
