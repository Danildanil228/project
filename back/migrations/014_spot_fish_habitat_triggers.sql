CREATE OR REPLACE FUNCTION enforce_spot_fish_habitat()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM spot s
        JOIN waterbody_fish wf
          ON wf.waterbody_id = s.waterbody_id
         AND wf.fish_id = NEW.fish_id
        WHERE s.id = NEW.spot_id
    ) THEN
        RAISE EXCEPTION 'Fish does not inhabit the spot waterbody' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS spot_fish_habitat_guard ON spot_fish;
CREATE TRIGGER spot_fish_habitat_guard
BEFORE INSERT OR UPDATE OF spot_id, fish_id ON spot_fish
FOR EACH ROW EXECUTE FUNCTION enforce_spot_fish_habitat();

CREATE OR REPLACE FUNCTION remove_spot_fish_after_habitat_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM spot_fish sf
    USING spot s
    WHERE sf.spot_id = s.id
      AND s.waterbody_id = OLD.waterbody_id
      AND sf.fish_id = OLD.fish_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS waterbody_fish_spot_cleanup ON waterbody_fish;
CREATE TRIGGER waterbody_fish_spot_cleanup
AFTER DELETE ON waterbody_fish
FOR EACH ROW EXECUTE FUNCTION remove_spot_fish_after_habitat_delete();
