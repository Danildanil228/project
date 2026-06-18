import { Router } from "express";
import { requireRole, type SessionUser } from "../lib/admin-auth";
import { parseOrSend } from "../lib/validation";
import { reportIdParamsSchema, reportQuerySchema, reportResolveSchema } from "../lib/engagement-schemas";
import { countOpenReports, listReports, resolveReport } from "../services/report-service";

const moderatorRoles = ["admin", "moderator"];

const router = Router();

router.get("/", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, moderatorRoles);
        if (!session) return;
        const query = parseOrSend(reportQuerySchema, req.query, res);
        if (!query) return;
        res.json(await listReports(query));
    } catch (error) {
        next(error);
    }
});

router.get("/count", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, moderatorRoles);
        if (!session) return;
        res.json({ open: await countOpenReports() });
    } catch (error) {
        next(error);
    }
});

router.post("/:id/resolve", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, moderatorRoles);
        if (!session) return;
        const params = parseOrSend(reportIdParamsSchema, req.params, res);
        const body = parseOrSend(reportResolveSchema, req.body, res);
        if (!params || !body) return;
        const result = await resolveReport(params.id, session.user as SessionUser, body.status);
        if (result.status === "invalid") return void res.status(409).json({ message: "Жалоба уже обработана" });
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

export const reportsRouter = router;
