# Отправка писем через Selectel

## Важное ограничение

Почтовый сервис Selectel принимает SMTP-письма только от серверов в инфраструктуре Selectel. Если API работает на FirstVDS или у другого провайдера, используйте SMTP-провайдера, который разрешает подключения с внешних серверов. Код приложения при этом менять не нужно: заменяются только переменные `SMTP_*` в `.env`.

## Подключение временного домена materialhouse.ru

1. В панели Selectel откройте **Продукты → Почтовый сервис** и создайте ресурс.
2. На вкладке **Информация** скопируйте ключ проверки владения доменом.
3. В DNS домена создайте TXT-запись для `materialhouse.ru` со скопированным ключом.
4. Добавьте `materialhouse.ru` в почтовый ресурс без `https://` и завершающего `/`.
5. Добавьте TXT-запись DKIM:
   - имя: `selcloud._domainkey.materialhouse.ru`;
   - значение: скопируйте из карточки домена в Selectel.
6. Добавьте TXT-запись DMARC:
   - имя: `_dmarc.materialhouse.ru`;
   - значение: `v=DMARC1; p=quarantine;`.
7. Добавьте единственную SPF TXT-запись домена: `v=spf1 include:spf.mail.selcloud.ru ?all`. Если SPF уже существует, добавьте `include:spf.mail.selcloud.ru` в существующую запись, не создавая вторую.
8. В информации о почтовом ресурсе скопируйте SMTP-логин и SMTP-пароль.

Некоторые DNS-панели автоматически дописывают домен. В такой панели вместо полного имени записи указываются `@`, `selcloud._domainkey` и `_dmarc`.

## Переменные сервера

Добавьте в `/var/www/rf4/back/.env`:

```env
NODE_ENV=production
EMAIL_TRANSPORT=smtp
SMTP_HOST=smtp.mail.selcloud.ru
SMTP_PORT=1127
SMTP_SECURE=true
SMTP_USER=ЛОГИН_ИЗ_SELECTEL
SMTP_PASSWORD=ПАРОЛЬ_ИЗ_SELECTEL
EMAIL_FROM="RF4 Community <no-reply@materialhouse.ru>"
EMAIL_REPLY_TO=
```

Не добавляйте настоящий SMTP-пароль в Git и не присылайте его в чат.

## Установка и проверка

После получения изменений на сервере:

```bash
cd /var/www/rf4/back
npm install
npm run typecheck
npm run email:test -- ВАШ_ЛИЧНЫЙ_EMAIL
pm2 restart rf4-api --update-env
pm2 logs rf4-api --lines 100
```

Команда `email:test` сначала проверяет SMTP-соединение, затем отправляет одно тестовое письмо. После этого проверьте регистрацию, повторную отправку кода, смену пароля и восстановление пароля.

## Локальная разработка

На локальном компьютере оставьте:

```env
EMAIL_TRANSPORT=console
```

Коды и ссылки продолжат появляться в консоли бэкенда, SMTP-логин для локальной разработки не потребуется.

## Переезд на постоянный домен

1. Добавьте новый домен в почтовый ресурс и подтвердите его.
2. Создайте для него DKIM, DMARC и SPF.
3. Измените `EMAIL_FROM`, `BETTER_AUTH_URL`, `PUBLIC_API_URL` и `FRONTEND_ORIGINS` в `.env`.
4. Обновите OAuth callback URL у Discord и VK.
5. Перезапустите API командой `pm2 restart rf4-api --update-env` и повторите `npm run email:test`.
