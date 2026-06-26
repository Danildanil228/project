-- Remove legacy spot/fish relations that contradict the waterbody habitat list.
DELETE FROM spot_fish sf
USING spot s
WHERE sf.spot_id = s.id
  AND NOT EXISTS (
      SELECT 1
      FROM waterbody_fish wf
      WHERE wf.waterbody_id = s.waterbody_id
        AND wf.fish_id = sf.fish_id
  );
