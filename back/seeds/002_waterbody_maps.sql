-- Local development maps. The generated files live in ignored back/uploads/items.

UPDATE waterbody
SET name = 'р. Северский Донец'
WHERE name = 'р. Северный Донец';

UPDATE waterbody AS waterbody
SET photo = data.photo,
    coordinate_min_x = data.min_x,
    coordinate_min_y = data.min_y,
    coordinate_max_x = data.max_x,
    coordinate_max_y = data.max_y
FROM (VALUES
    ('оз. Комариное', '/uploads/items/rf4-map-komarino.jpg', 33::numeric, 37::numeric, 108::numeric, 112::numeric),
    ('р. Вьюнок', '/uploads/items/rf4-map-vyunok.jpg', 48, 58, 138, 146),
    ('оз. Куори', '/uploads/items/rf4-map-kuori.jpg', 57, 56, 145, 145),
    ('Старый Острог', '/uploads/items/rf4-map-old-fort.jpg', 0, 2, 80, 80),
    ('р. Волхов', '/uploads/items/rf4-map-volkhov.jpg', -3, -3, 202, 202),
    ('Ладожское оз.', '/uploads/items/rf4-map-ladoga.jpg', 9, 3, 98, 93),
    ('оз. Медвежье', '/uploads/items/rf4-map-bear-lake.jpg', 10, 7, 90, 90),
    ('р. Сура', '/uploads/items/rf4-map-sura.jpg', -4, -4, 162, 163),
    ('р. Ахтуба', '/uploads/items/rf4-map-akhtuba.jpg', -4, -9, 207, 207),
    ('р. Белая', '/uploads/items/rf4-map-belaya.jpg', -1, -3, 112, 101),
    ('р. Северский Донец', '/uploads/items/rf4-map-seversky-donets.jpg', 7, 7, 195, 195),
    ('оз. Янтарное', '/uploads/items/rf4-map-amber-lake.jpg', 1, 19, 192, 212),
    ('р. Нижняя Тунгуска', '/uploads/items/rf4-map-lower-tunguska.jpg', -8, -6, 248, 244),
    ('р. Яма', '/uploads/items/rf4-map-yama.jpg', -8, -10, 307, 312),
    ('оз. Медное', '/uploads/items/rf4-map-copper-lake.jpg', 27, 27, 77, 77),
    ('оз. Лосиное', '/uploads/items/rf4-map-losinoe.jpg', 32, 32, 162, 162)
) AS data(name, photo, min_x, min_y, max_x, max_y)
WHERE waterbody.name = data.name;

UPDATE waterbody
SET photo = '/uploads/items/rf4-map-ladoga-archipelago.jpg'
WHERE name = 'Ладожский Архипелаг';

UPDATE waterbody
SET photo = '/uploads/items/rf4-map-norwegian-sea.jpg'
WHERE name = 'Норвежское море';
