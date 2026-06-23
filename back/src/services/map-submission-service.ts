import type { PoolClient } from "pg";
import type { z } from "zod";
import { pool } from "../lib/db";
import type { SessionUser } from "../lib/admin-auth";
import { writeAuditLog } from "../lib/audit-log";
import type { mapSubmissionApproveSchema, mapSubmissionListSchema } from "../lib/map-submission-schemas";
import { translateDbError } from "../lib/db-errors";
import { createNotification } from "./notification-service";

type ApproveInput = z.infer<typeof mapSubmissionApproveSchema>;
type ListQuery = z.infer<typeof mapSubmissionListSchema>;

export async function createPendingMapSubmission(client: PoolClient, postId: number, versionId: number) {
    const linkedSpot = await client.query<{ spotId: number }>(`SELECT spot_id AS "spotId" FROM spot_post WHERE post_id=$1`, [postId]);
    await client.query(`DELETE FROM spot_post WHERE post_id=$1`, [postId]);
    if (linkedSpot.rows[0]) {
        await client.query(`UPDATE spot SET is_active=FALSE,updated_at=NOW() WHERE id=$1 AND is_community=TRUE AND NOT EXISTS(SELECT 1 FROM spot_post WHERE spot_id=$1)`, [linkedSpot.rows[0].spotId]);
    }
    const version = await client.query(`SELECT waterbody_id AS "waterbodyId", proposed_spot_id AS "proposedSpotId", map_x::float AS "mapX", map_y::float AS "mapY", game_coordinate_x::float AS "gameX", game_coordinate_y::float AS "gameY", bait_mode AS "baitMode" FROM post_version WHERE id=$1`, [versionId]);
    const item = version.rows[0];
    if (!item?.waterbodyId || item.mapX === null || item.mapY === null || item.gameX === null || item.gameY === null) {
        await client.query(`DELETE FROM map_submission WHERE post_id=$1`, [postId]);
        return null;
    }
    const result = await client.query<{ id: number }>(`INSERT INTO map_submission(post_id,post_version_id,proposed_spot_id,waterbody_id,map_x,map_y,game_coordinate_x,game_coordinate_y,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending') ON CONFLICT(post_id) DO UPDATE SET post_version_id=EXCLUDED.post_version_id,proposed_spot_id=EXCLUDED.proposed_spot_id,waterbody_id=EXCLUDED.waterbody_id,map_x=EXCLUDED.map_x,map_y=EXCLUDED.map_y,game_coordinate_x=EXCLUDED.game_coordinate_x,game_coordinate_y=EXCLUDED.game_coordinate_y,status='pending',resolved_spot_id=NULL,reviewed_by=NULL,reviewed_at=NULL,rejection_reason=NULL,created_at=NOW() RETURNING id`, [postId,versionId,item.proposedSpotId,item.waterbodyId,item.mapX,item.mapY,item.gameX,item.gameY]);
    const submissionId=Number(result.rows[0].id);
    await client.query(`DELETE FROM map_submission_target WHERE submission_id=$1`,[submissionId]);
    const catches=await client.query<{fishId:number}>(`SELECT fish_id AS "fishId" FROM catch WHERE post_version_id=$1`,[versionId]);
    for(const caught of catches.rows){
        const target=await client.query<{id:number}>(`INSERT INTO map_submission_target(submission_id,fish_id) VALUES($1,$2) RETURNING id`,[submissionId,caught.fishId]);
        const baits=await client.query<{baitId:number}>(`SELECT bait_id AS "baitId" FROM post_version_bait WHERE post_version_id=$1 AND (fish_id=$2 OR (fish_id IS NULL AND $3='common'))`,[versionId,caught.fishId,item.baitMode]);
        if(baits.rows.length) await client.query(`INSERT INTO map_submission_target_bait(target_id,bait_id) SELECT $1,UNNEST($2::int[])`,[target.rows[0].id,baits.rows.map((bait)=>bait.baitId)]);
    }
    return submissionId;
}

async function attachTargets<T extends {id:number}>(items:T[]){
    if(!items.length)return items;
    const targets=await pool.query(`SELECT mst.submission_id AS "submissionId",mst.id,mst.fish_id AS "fishId",f.name AS "fishName",COALESCE((SELECT json_agg(json_build_object('id',b.id,'name',b.name) ORDER BY b.name) FROM map_submission_target_bait mstb JOIN bait b ON b.id=mstb.bait_id WHERE mstb.target_id=mst.id),'[]'::json) AS baits FROM map_submission_target mst JOIN fish f ON f.id=mst.fish_id WHERE mst.submission_id=ANY($1::bigint[]) ORDER BY f.name`,[items.map((item)=>item.id)]);
    return items.map((item)=>({...item,targets:targets.rows.filter((target)=>Number(target.submissionId)===Number(item.id)).map(({submissionId:_submissionId,...target})=>target)}));
}

export async function listMapSubmissions(query:ListQuery){
    const values:unknown[]=[];const where:string[]=[];
    if(query.status){values.push(query.status);where.push(`ms.status=$${values.length}`);}
    const whereSql=where.length?`WHERE ${where.join(" AND ")}`:"";
    const count=await pool.query<{count:number}>(`SELECT COUNT(*)::int AS count FROM map_submission ms ${whereSql}`,values);
    values.push(query.limit,query.offset);
    const rows=await pool.query(`SELECT ms.id::int,ms.post_id AS "postId",ms.status,ms.proposed_spot_id AS "proposedSpotId",ms.waterbody_id AS "waterbodyId",w.name AS "waterbodyName",ms.map_x::float AS "mapX",ms.map_y::float AS "mapY",ms.game_coordinate_x::float AS "gameCoordinateX",ms.game_coordinate_y::float AS "gameCoordinateY",ms.created_at AS "createdAt",p.author_id AS "authorId",u.name AS "authorName",pv.description FROM map_submission ms JOIN post p ON p.id=ms.post_id JOIN post_version pv ON pv.id=ms.post_version_id JOIN "user" u ON u.id=p.author_id JOIN waterbody w ON w.id=ms.waterbody_id ${whereSql} ORDER BY ms.created_at ASC LIMIT $${values.length-1} OFFSET $${values.length}`,values);
    return {items:await attachTargets(rows.rows),total:count.rows[0]?.count??0,limit:query.limit,offset:query.offset};
}

export async function approveMapSubmission(id:number,reviewer:SessionUser,input:ApproveInput){
 const client=await pool.connect();try{await client.query("BEGIN");const found=await client.query(`SELECT ms.*,p.author_id AS "authorId" FROM map_submission ms JOIN post p ON p.id=ms.post_id WHERE ms.id=$1 FOR UPDATE`,[id]);const submission=found.rows[0];if(!submission){await client.query("ROLLBACK");return {status:"not-found" as const};}if(submission.status!=="pending"){await client.query("ROLLBACK");return {status:"invalid" as const};}if(submission.authorId===reviewer.id){await client.query("ROLLBACK");return {status:"self" as const};}
 const fishIds=[...new Set(input.targets.map((target)=>target.fishId))];const allowed=await client.query(`SELECT fish_id FROM waterbody_fish WHERE waterbody_id=$1 AND fish_id=ANY($2::int[])`,[submission.waterbody_id,fishIds]);if(allowed.rowCount!==fishIds.length)throw Object.assign(new Error("В заявке есть рыба, не обитающая в этом водоёме"),{statusCode:400});
 let spotId=input.spotId;if(spotId){const spot=await client.query(`SELECT id FROM spot WHERE id=$1 AND waterbody_id=$2`,[spotId,submission.waterbody_id]);if(!spot.rowCount)throw Object.assign(new Error("Выбранная точка относится к другому водоёму"),{statusCode:400});}else{const spot=await client.query<{id:number}>(`INSERT INTO spot(waterbody_id,name,map_x,map_y,game_coordinate_x,game_coordinate_y,is_active,is_community,created_by) VALUES($1,$2,$3,$4,$5,$6,TRUE,TRUE,$7) RETURNING id`,[submission.waterbody_id,input.name,input.mapX,input.mapY,input.gameCoordinateX,input.gameCoordinateY,reviewer.id]);spotId=Number(spot.rows[0].id);}
 await client.query(`DELETE FROM map_submission_target WHERE submission_id=$1`,[id]);for(const targetInput of input.targets){const target=await client.query<{id:number}>(`INSERT INTO map_submission_target(submission_id,fish_id) VALUES($1,$2) RETURNING id`,[id,targetInput.fishId]);if(targetInput.baitIds.length)await client.query(`INSERT INTO map_submission_target_bait(target_id,bait_id) SELECT $1,UNNEST($2::int[])`,[target.rows[0].id,targetInput.baitIds]);}
 await client.query(`UPDATE spot SET is_active=TRUE,updated_at=NOW() WHERE id=$1`,[spotId]);
 await client.query(`UPDATE post_version SET proposed_spot_id=$2 WHERE id=$1`,[submission.post_version_id,spotId]);
 await client.query(`INSERT INTO spot_post(spot_id,post_id,submission_id) VALUES($1,$2,$3) ON CONFLICT(post_id) DO UPDATE SET spot_id=EXCLUDED.spot_id,submission_id=EXCLUDED.submission_id,approved_at=NOW()`,[spotId,submission.post_id,id]);
 await client.query(`INSERT INTO spot_fish(spot_id,fish_id) SELECT $1,UNNEST($2::int[]) ON CONFLICT DO NOTHING`,[spotId,fishIds]);const baitIds=[...new Set(input.targets.flatMap((target)=>target.baitIds))];if(baitIds.length)await client.query(`INSERT INTO spot_bait(spot_id,bait_id) SELECT $1,UNNEST($2::int[]) ON CONFLICT DO NOTHING`,[spotId,baitIds]);
 await client.query(`UPDATE map_submission SET status='approved',resolved_spot_id=$2,reviewed_by=$3,reviewed_at=NOW() WHERE id=$1`,[id,spotId,reviewer.id]);await client.query("COMMIT");await writeAuditLog({actor:reviewer,action:"map-submission.approve",targetUserId:submission.authorId,metadata:{submissionId:id,postId:submission.post_id,spotId}});await createNotification({userId:submission.authorId,type:"map_submission_approved",postId:submission.post_id,actorId:reviewer.id,data:{spotId}});return {status:"ok" as const,spotId};}catch(error){await client.query("ROLLBACK").catch(()=>undefined);translateDbError(error);}finally{client.release();}
}

export async function rejectMapSubmission(id:number,reviewer:SessionUser,reason:string){const result=await pool.query(`UPDATE map_submission ms SET status='rejected',reviewed_by=$2,reviewed_at=NOW(),rejection_reason=$3 FROM post p WHERE ms.id=$1 AND ms.status='pending' AND p.id=ms.post_id AND p.author_id<>$2 RETURNING p.author_id AS "authorId",ms.post_id AS "postId"`,[id,reviewer.id,reason]);if(!result.rowCount)return {status:"invalid" as const};await writeAuditLog({actor:reviewer,action:"map-submission.reject",targetUserId:result.rows[0].authorId,metadata:{submissionId:id,postId:result.rows[0].postId,reason}});await createNotification({userId:result.rows[0].authorId,type:"map_submission_rejected",postId:result.rows[0].postId,actorId:reviewer.id,data:{reason}});return {status:"ok" as const};}
