CREATE OR REPLACE FUNCTION public.enforce_spot_fish_habitat()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.spot s
        JOIN public.waterbody_fish wf
          ON wf.waterbody_id = s.waterbody_id
         AND wf.fish_id = NEW.fish_id
        WHERE s.id = NEW.spot_id
    ) THEN
        RAISE EXCEPTION 'Fish does not inhabit the spot waterbody' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_spot_fish_after_habitat_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
    DELETE FROM public.spot_fish sf
    USING public.spot s
    WHERE sf.spot_id = s.id
      AND s.waterbody_id = OLD.waterbody_id
      AND sf.fish_id = OLD.fish_id;
    RETURN OLD;
END;
$$;
