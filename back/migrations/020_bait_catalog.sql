-- Extends the original bait reference into an RF4 catalog without changing
-- existing bait ids referenced by spots and post drafts.

CREATE TABLE bait_category (
    code VARCHAR(40) PRIMARY KEY,
    domain VARCHAR(8) NOT NULL CHECK (domain IN ('bait', 'lure')),
    name_ru VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE (code, domain)
);

INSERT INTO bait_category (code, domain, name_ru, sort_order) VALUES
    ('sets', 'bait', 'Комплекты', 10),
    ('worms', 'bait', 'Черви', 20),
    ('larvae', 'bait', 'Личинки', 30),
    ('insects', 'bait', 'Насекомые', 40),
    ('crustaceans', 'bait', 'Рачки', 50),
    ('porridge_dough', 'bait', 'Каши и тесто', 60),
    ('natural', 'bait', 'Натуральные', 70),
    ('live', 'bait', 'Живые', 80),
    ('live_fish', 'bait', 'Живцы', 90),
    ('nuts', 'bait', 'Орехи', 100),
    ('sinking_boilies', 'bait', 'Тонущие бойлы', 110),
    ('pop_up_boilies', 'bait', 'Pop-up бойлы', 120),
    ('pellets', 'bait', 'Пеллетс', 130),
    ('artificial_corn', 'bait', 'Искусственная кукуруза', 140),
    ('zig_rig_foam', 'bait', 'Зиг-риг пенки', 150),
    ('marine_bait', 'bait', 'Морские наживки', 160),
    ('dead_fish', 'bait', 'Мёртвая рыба', 170),
    ('fish_fillet', 'bait', 'Кусочки рыбы', 180),
    ('lure_sets', 'lure', 'Комплекты', 200),
    ('wobblers', 'lure', 'Воблеры', 210),
    ('spoons', 'lure', 'Блесны-колебалки', 220),
    ('spinners', 'lure', 'Блесны-вращалки', 230),
    ('spinnerbaits', 'lure', 'Спиннербейты', 240),
    ('topwater', 'lure', 'Топвотеры', 250),
    ('jerkbaits', 'lure', 'Джеркбейты', 260),
    ('skirted_jigs', 'lure', 'Джиги с опушкой', 270),
    ('soft_plastic', 'lure', 'Мягкие приманки', 280),
    ('wacky_worms', 'lure', 'Вэки-черви', 290),
    ('pilkers', 'lure', 'Пилкеры', 300),
    ('giant_shads', 'lure', 'Гигантские виброхвосты', 310),
    ('gummi_makk', 'lure', 'Перчики', 320),
    ('octopus', 'lure', 'Октопусы', 330),
    ('shrimp', 'lure', 'Креветки', 340),
    ('silicon_sea_worms', 'lure', 'Силиконовые морские черви', 350),
    ('attraction_elements', 'lure', 'Привлекающие элементы', 360),
    ('tube_baits', 'lure', 'Трубчатые приманки', 370),
    ('dead_fish_jigheads', 'lure', 'Джиг-головки с рыбой', 380),
    ('flies', 'lure', 'Мушки', 390),
    ('artificial_rodents', 'lure', 'Искусственные грызуны', 400)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE bait_brand (
    id BIGSERIAL PRIMARY KEY,
    system_id VARCHAR(150) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bait_family (
    id BIGSERIAL PRIMARY KEY,
    brand_id BIGINT NOT NULL REFERENCES bait_brand(id) ON DELETE RESTRICT,
    system_id VARCHAR(150) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (brand_id, system_id)
);

DROP INDEX IF EXISTS bait_name_ci_unique;

ALTER TABLE bait
    ALTER COLUMN photo TYPE VARCHAR(500),
    ADD COLUMN system_id VARCHAR(150),
    ADD COLUMN domain VARCHAR(8) NOT NULL DEFAULT 'bait' CHECK (domain IN ('bait', 'lure')),
    ADD COLUMN category_code VARCHAR(40) REFERENCES bait_category(code) ON DELETE RESTRICT,
    ADD COLUMN family_id BIGINT REFERENCES bait_family(id) ON DELETE SET NULL,
    ADD COLUMN source_brand_hint VARCHAR(150),
    ADD COLUMN variant_code VARCHAR(100),
    ADD COLUMN quality VARCHAR(8) CHECK (quality IN ('hq', 'mq', 'lq')),
    ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'rf4_catalog')),
    ADD COLUMN source_bundle VARCHAR(150),
    ADD COLUMN prefab_path TEXT;

ALTER TABLE bait ADD CONSTRAINT bait_category_domain_fk
    FOREIGN KEY (category_code, domain) REFERENCES bait_category(code, domain) ON DELETE RESTRICT;

UPDATE bait SET
    domain = CASE WHEN kind = 'artificial_lure' THEN 'lure' ELSE 'bait' END,
    category_code = CASE kind
        WHEN 'natural' THEN 'natural'
        WHEN 'prepared' THEN 'porridge_dough'
        WHEN 'boilie' THEN 'sinking_boilies'
        WHEN 'pellet' THEN 'pellets'
        WHEN 'marine' THEN 'marine_bait'
        ELSE NULL
    END;

CREATE UNIQUE INDEX bait_domain_system_id_unique ON bait (domain, system_id);
CREATE INDEX bait_catalog_filter_idx ON bait (domain, category_code, is_active);
CREATE INDEX bait_family_idx ON bait (family_id);
CREATE INDEX bait_name_ci_idx ON bait (LOWER(name));
CREATE INDEX bait_family_name_ci_idx ON bait_family (LOWER(name));
CREATE INDEX bait_brand_name_ci_idx ON bait_brand (LOWER(name));
