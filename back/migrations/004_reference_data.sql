-- Reference data: fish and waterbodies, plus which fish live in each waterbody.

CREATE TABLE IF NOT EXISTS fish (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    rarity VARCHAR(20) NOT NULL CHECK (rarity IN ('Обычный', 'Редкий', 'Редчайший')),
    photo VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS waterbody (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    photo VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS waterbody_fish (
    waterbody_id INT NOT NULL REFERENCES waterbody(id) ON DELETE CASCADE,
    fish_id INT NOT NULL REFERENCES fish(id) ON DELETE CASCADE,
    PRIMARY KEY (waterbody_id, fish_id)
);

CREATE INDEX IF NOT EXISTS waterbody_fish_fish_idx ON waterbody_fish (fish_id);
