import { pool } from "../lib/db";
import type { SessionUser } from "../lib/admin-auth";
import { writeAuditLog } from "../lib/audit-log";

export async function getReactionSummary(postId: number, userId?: string) {
    const { rows } = await pool.query<{ likes: number; dislikes: number }>(
        `
            SELECT
                COUNT(*) FILTER (WHERE value = 1)::int AS likes,
                COUNT(*) FILTER (WHERE value = -1)::int AS dislikes
            FROM reaction WHERE post_id = $1
        `,
        [postId],
    );
    let mine: 1 | -1 | 0 = 0;
    if (userId) {
        const own = await pool.query<{ value: number }>(`SELECT value FROM reaction WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
        if (own.rows[0]) mine = own.rows[0].value === 1 ? 1 : -1;
    }
    return { likes: rows[0]?.likes ?? 0, dislikes: rows[0]?.dislikes ?? 0, mine };
}

// Sets the user's reaction. Re-sending the current value clears it (toggle off); a different value switches.
export async function setReaction(postId: number, user: SessionUser, value: 1 | -1) {
    const post = await pool.query<{ status: string; authorId: string }>(`SELECT status, author_id AS "authorId" FROM post WHERE id = $1`, [postId]);
    if (!post.rows[0]) return { status: "not-found" as const };
    if (post.rows[0].status !== "approved") return { status: "invalid" as const };

    const existing = await pool.query<{ value: number }>(`SELECT value FROM reaction WHERE post_id = $1 AND user_id = $2`, [postId, user.id]);
    const previousValue = existing.rows[0]?.value ?? 0;
    let action: "reaction.set" | "reaction.change" | "reaction.remove";
    if (existing.rows[0]?.value === value) {
        await pool.query(`DELETE FROM reaction WHERE post_id = $1 AND user_id = $2`, [postId, user.id]);
        action = "reaction.remove";
    } else {
        await pool.query(
            `INSERT INTO reaction (post_id, user_id, value) VALUES ($1, $2, $3)
             ON CONFLICT (post_id, user_id) DO UPDATE SET value = EXCLUDED.value, created_at = NOW()`,
            [postId, user.id, value],
        );
        action = previousValue ? "reaction.change" : "reaction.set";
    }

    await writeAuditLog({
        actor: user,
        action,
        targetUserId: post.rows[0].authorId,
        metadata: { postId, value: action === "reaction.remove" ? 0 : value, previousValue },
    });
    return { status: "ok" as const, summary: await getReactionSummary(postId, user.id) };
}
