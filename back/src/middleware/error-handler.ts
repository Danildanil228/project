import type { ErrorRequestHandler, RequestHandler } from "express";

export const notFoundHandler: RequestHandler = (req, res) => {
    res.status(404).json({
        message: `Route not found: ${req.method} ${req.path}`,
    });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = Number(error?.statusCode ?? error?.status ?? 500);
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    const isPublicError = safeStatus < 500;
    const message = isPublicError
        ? error?.message || "Request failed"
        : "Internal server error";

    if (!isPublicError) {
        console.error(error);
    }

    res.status(safeStatus).json({ message });
};
