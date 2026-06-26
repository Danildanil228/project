-- Development-only sample records derived from unambiguous prefab names.
-- This file intentionally does not reference or distribute extracted GLB files.

INSERT INTO bait (name, kind, description, is_active) VALUES
    ('Мотыль', 'natural', 'Естественная наживка.', TRUE),
    ('Чёрная пиявка', 'natural', 'Естественная наживка.', TRUE),
    ('Опарыш', 'natural', 'Естественная наживка.', TRUE),
    ('Ручейник', 'natural', 'Естественная наживка.', TRUE),
    ('Навозный червь', 'natural', 'Естественная наживка.', TRUE),
    ('Кузнечик', 'natural', 'Естественная наживка.', TRUE),
    ('Живец', 'natural', 'Живая рыбка, используемая как наживка.', TRUE),
    ('Хлеб', 'prepared', 'Подготовленная растительная насадка.', TRUE),
    ('Сырный кубик', 'prepared', 'Подготовленная насадка.', TRUE),
    ('Кукуруза', 'prepared', 'Подготовленная растительная насадка.', TRUE),
    ('Чесночное тесто', 'prepared', 'Подготовленная насадка из теста.', TRUE),
    ('Перловая каша', 'prepared', 'Подготовленная растительная насадка.', TRUE),
    ('Картофель', 'prepared', 'Подготовленная растительная насадка.', TRUE),
    ('Нереис', 'marine', 'Морская наживка.', TRUE),
    ('Мидия', 'marine', 'Морская наживка.', TRUE),
    ('Креветка', 'marine', 'Морская наживка.', TRUE),
    ('Мясо краба', 'marine', 'Морская наживка.', TRUE),
    ('Сухая прикормочная смесь', 'groundbait_component', 'Основа для приготовления прикормки.', TRUE),
    ('Комбикорм', 'groundbait_component', 'Компонент прикормочной смеси.', TRUE),
    ('Пшеница', 'groundbait_component', 'Компонент прикормочной смеси.', TRUE)
ON CONFLICT (LOWER(name)) DO NOTHING;
