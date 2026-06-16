-- In-game item reference tables (reels, rods).
-- Standalone catalog; posts do not reference these tables.

CREATE TABLE IF NOT EXISTS reels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL CHECK (category IN ('Безинерционные', 'Байткастинговые', 'Силовые', 'Низкопрофильные')),
    brend VARCHAR(100) NOT NULL,
    size INT CHECK (size IN (10, 20, 30, 40, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 10000, 20000, 30000)),
    test VARCHAR(20) NOT NULL,
    protection BOOL DEFAULT FALSE,
    per VARCHAR(10) NOT NULL,
    per_mod VARCHAR(10) DEFAULT NULL,
    speed VARCHAR(10) NOT NULL,
    speed_mod VARCHAR(10) DEFAULT NULL,
    frik VARCHAR(10) NOT NULL,
    frik_mod VARCHAR(10) DEFAULT NULL,
    meh VARCHAR(10) NOT NULL,
    meh_mod VARCHAR(10) DEFAULT NULL,
    lvl INT NOT NULL,
    price_ser VARCHAR(20),
    price_gold VARCHAR(10),
    capacity VARCHAR(20),
    photo VARCHAR(100),
    model VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS rods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL CHECK (category IN ('Спининговые', 'Доночные', 'Поплавочные', 'Морские')),
    type VARCHAR(100) NOT NULL,
    brend VARCHAR(100) NOT NULL,
    power VARCHAR(20),
    test_down VARCHAR(10) NOT NULL,
    test_up VARCHAR(10) NOT NULL,
    length VARCHAR(10) NOT NULL,
    sensi VARCHAR(10) NOT NULL,
    rig VARCHAR(10) NOT NULL,
    stroy VARCHAR(40) NOT NULL CHECK (stroy IN ('Быстрый', 'Медленный', 'Сверхбыстрый', 'Средний')),
    bonus_opit VARCHAR(10) DEFAULT NULL,
    bonus_snast VARCHAR(100) DEFAULT NULL,
    bonus_nav VARCHAR(10) DEFAULT NULL,
    bonus_zabros VARCHAR(10) DEFAULT NULL,
    stren VARCHAR(10) NOT NULL,
    lvl INT NOT NULL,
    price_ser VARCHAR(20),
    price_gold VARCHAR(10),
    photo VARCHAR(100)
);
