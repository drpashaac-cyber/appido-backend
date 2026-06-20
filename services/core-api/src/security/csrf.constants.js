"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkipCsrf = exports.SKIP_CSRF = exports.CSRF_COOKIE = void 0;
const common_1 = require("@nestjs/common");
exports.CSRF_COOKIE = "appido_csrf";
exports.SKIP_CSRF = "skipCsrf";
/** Mark a route/controller exempt from CSRF (public, non-cookie endpoints). */
const SkipCsrf = () => (0, common_1.SetMetadata)(exports.SKIP_CSRF, true);
exports.SkipCsrf = SkipCsrf;
//# sourceMappingURL=csrf.constants.js.map