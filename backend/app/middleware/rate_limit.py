"""Rate-limit placeholder (Phase 3 production hardening).

Phase 0: no-op to keep POS fast. Protect auth/imports/reports later
with e.g. slowapi or gateway limits. See docs/11-security.md.
"""


async def rate_limit_middleware(request, call_next):
    return await call_next(request)
