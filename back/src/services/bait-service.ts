import type { z } from "zod";
import type { SessionUser } from "../lib/admin-auth";
import { writeAuditLog } from "../lib/audit-log";
import type { baitCreateSchema, baitListQuerySchema, baitUpdateSchema } from "../lib/bait-schemas";
import { pool } from "../lib/db";
import { translateDbError } from "../lib/db-errors";
import { deleteUploadedMedia } from "../lib/uploads";

type BaitCreate = z.infer<typeof baitCreateSchema>;
type BaitUpdate = z.infer<typeof baitUpdateSchema>;
type BaitListQuery = z.infer<typeof baitListQuerySchema>;

const selectFields = `
    b.id,
    b.name,
    b.kind,
    b.domain,
    b.category_code AS "categoryCode",
    bc.name_ru AS "categoryName",
    b.photo,
    b.is_active AS "isActive",
    b.created_at AS "createdAt",
    b.updated_at AS "updatedAt"
`;

const fromCatalog = `
    FROM bait b
    LEFT JOIN bait_category bc ON bc.code = b.category_code
`;

const updatableFields = {
    name: "name",
    domain: "domain",
    categoryCode: "category_code",
    familyId: "family_id",
    systemId: "system_id",
    variantCode: "variant_code",
    quality: "quality",
    description: "description",
    photo: "photo",
    isActive: "is_active",
} as const;

function legacyKind(domain: BaitCreate["domain"], categoryCode: BaitCreate["categoryCode"]) {
    if (domain === "lure") return "artificial_lure";
    if (categoryCode === "sinking_boilies" || categoryCode === "pop_up_boilies") return "boilie";
    if (categoryCode === "pellets") return "pellet";
    if (categoryCode === "marine_bait") return "marine";
    if (["natural", "nuts", "worms", "larvae", "insects", "crustaceans", "live", "live_fish", "dead_fish", "fish_fillet"].includes(categoryCode)) return "natural";
    return "prepared";
}

export async function listBaits(query: BaitListQuery) {
    const where: string[] = [];
    const values: unknown[] = [];

    if (!query.includeInactive) where.push("b.is_active = TRUE");
    if (query.search) {
        values.push(`%${query.search}%`);
        where.push(`b.name ILIKE $${values.length}`);
    }
    if (query.domain) {
        values.push(query.domain);
        where.push(`b.domain = $${values.length}`);
    }
    if (query.categoryCode) {
        values.push(query.categoryCode);
        where.push(`b.category_code = $${values.length}`);
    }
    if (query.familyId) {
        values.push(query.familyId);
        where.push(`b.family_id = $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countResult = await pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count ${fromCatalog} ${whereSql}`, values);

    values.push(query.limit, query.offset);
    const { rows } = await pool.query(
        `SELECT ${selectFields} ${fromCatalog} ${whereSql} ORDER BY b.name ASC, b.system_id ASC NULLS LAST LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
    );

    return { items: rows, total: countResult.rows[0]?.count ?? 0, limit: query.limit, offset: query.offset };
}

export async function getBait(id: number) {
    const { rows } = await pool.query(`SELECT ${selectFields} ${fromCatalog} WHERE b.id = $1`, [id]);
    return rows[0] ?? null;
}

export async function getBaitCatalogMeta() {
    const categories = await pool.query(`SELECT code, domain, name_ru AS name FROM bait_category ORDER BY domain, sort_order, name_ru`);
    return { categories: categories.rows };
}

export async function createBait(data: BaitCreate, actor: SessionUser) {
    try {
        const { rows } = await pool.query(
            `INSERT INTO bait (system_id, name, kind, domain, category_code, family_id, variant_code, quality, description, photo, is_active, source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'manual')
             RETURNING id`,
            [data.systemId, data.name, legacyKind(data.domain, data.categoryCode), data.domain, data.categoryCode, data.familyId, data.variantCode, data.quality, data.description, data.photo, data.isActive],
        );
        const item = await getBait(rows[0].id);
        await writeAuditLog({ actor, action: "admin.bait.create", metadata: { id: rows[0].id, name: data.name, domain: data.domain, categoryCode: data.categoryCode } });
        return item;
    } catch (error) {
        translateDbError(error);
    }
}

export async function updateBait(id: number, data: BaitUpdate, actor: SessionUser) {
    const fields: string[] = [];
    const values: unknown[] = [];
    const previous = await getBait(id) as { photo?: string | null; domain?: BaitCreate["domain"]; categoryCode?: BaitCreate["categoryCode"] } | null;
    if (!previous) return null;

    for (const [inputField, column] of Object.entries(updatableFields)) {
        if (inputField in data) {
            values.push((data as Record<string, unknown>)[inputField] ?? null);
            fields.push(`${column} = $${values.length}`);
        }
    }

    const nextDomain = data.domain ?? previous.domain;
    const nextCategory = data.categoryCode ?? previous.categoryCode;
    if (nextDomain && nextCategory && ("domain" in data || "categoryCode" in data)) {
        values.push(legacyKind(nextDomain, nextCategory));
        fields.push(`kind = $${values.length}`);
    }
    if (fields.length === 0) return previous;

    values.push(id);
    try {
        const result = await pool.query(
            `UPDATE bait SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${values.length} RETURNING id`,
            values,
        );
        if (!result.rows[0]) return null;

        const item = await getBait(id) as { photo?: string | null; name?: string };
        if (previous.photo && previous.photo !== item.photo) await deleteUploadedMedia(previous.photo);
        await writeAuditLog({ actor, action: "admin.bait.update", metadata: { id, name: item.name, fields: Object.keys(data) } });
        return item;
    } catch (error) {
        translateDbError(error);
    }
}

export async function deleteBait(id: number, actor: SessionUser) {
    try {
        const { rows } = await pool.query(`DELETE FROM bait WHERE id = $1 RETURNING id, name, photo`, [id]);
        if (!rows[0]) return null;

        await deleteUploadedMedia(rows[0].photo);
        await writeAuditLog({ actor, action: "admin.bait.delete", metadata: { id, name: rows[0].name } });
        return { id: rows[0].id, name: rows[0].name };
    } catch (error) {
        translateDbError(error);
    }
}
