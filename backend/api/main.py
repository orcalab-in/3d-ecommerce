"""FastAPI application factory.

Replace {{PROJECT_NAME}} with your product's display name (e.g. "Expense Manager").
Register one router per resource in the `for router in (...)` loop below — see
`routers/items.py` for the worked example, then clone it per entity.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from api.config import settings
from api.limiter import limiter
from api.middleware.logging import LoggingMiddleware
from api.middleware.security_headers import SecurityHeadersMiddleware
from api.routers import (
    addresses,
    auth,
    cart,
    categories,
    colors,
    delivery,
    orders,
    pricing,
    print_jobs,
    products,
    uploads,
    users,
)


class SafeSlowAPIMiddleware(SlowAPIMiddleware):
    """Wraps SlowAPIMiddleware to pre-initialise view_rate_limit on every request.

    When Redis is unavailable and swallow_errors=True, slowapi's
    _check_request_limit silently returns without setting
    request.state.view_rate_limit, causing _inject_headers to crash with
    AttributeError.  Pre-setting it to None makes _inject_headers a no-op
    instead of raising.
    """

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        request.state.view_rate_limit = None
        return await super().dispatch(request, call_next)


def create_app() -> FastAPI:
    app = FastAPI(
        title="3D Printing E-commerce API",
        version="1.0.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
    )

    # ------------------------------------------------------------------
    # Rate limiter (shared instance — defined in api/limiter.py)
    # ------------------------------------------------------------------
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]
    app.add_middleware(SafeSlowAPIMiddleware)

    # ------------------------------------------------------------------
    # CORS
    # ------------------------------------------------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
    )

    # ------------------------------------------------------------------
    # Custom middleware (order matters: outermost runs first on request,
    # last on response)
    # ------------------------------------------------------------------
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)

    # ------------------------------------------------------------------
    # Prometheus metrics
    # ------------------------------------------------------------------
    Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        should_respect_env_var=False,
        excluded_handlers=["/health", "/metrics"],
    ).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

    # ------------------------------------------------------------------
    # Routers — register one per resource
    # ------------------------------------------------------------------
    for router in (
        auth.router,
        users.router,
        categories.router,
        colors.router,
        products.router,
        cart.router,
        addresses.router,
        orders.router,
        uploads.router,
        pricing.router,
        delivery.router,
        print_jobs.router,
    ):
        app.include_router(router)

    # ------------------------------------------------------------------
    # Health check (no auth, no version prefix)
    # ------------------------------------------------------------------
    @app.get("/health", include_in_schema=False)
    async def health() -> dict:
        from api.services.supabase_client import get_supabase
        try:
            get_supabase().table("users").select("id").limit(1).execute()
            db_status = "ok"
        except Exception as e:
            db_status = f"error: {e}"
        return {"status": "ok", "db": db_status}

    # ------------------------------------------------------------------
    # Global exception handler — never leak stack traces in production
    # ------------------------------------------------------------------
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        import structlog

        structlog.get_logger().error(
            "unhandled_exception",
            path=request.url.path,
            error=str(exc),
            exc_info=exc,
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )

    return app


app = create_app()
