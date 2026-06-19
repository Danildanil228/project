# Развёртывание RF4 на materialhouse.ru

Инструкция рассчитана на Ubuntu, чистую PostgreSQL и ветку `codex/deployment`.
Backend работает от отдельного системного пользователя `rf4` через systemd. Nginx
отдаёт собранный frontend и проксирует `/api` и `/uploads` на `127.0.0.1:3000`.

## 0. До начала

1. Смените пароль VPS, который был передан через чат:

   ```bash
   passwd
   ```

2. Убедитесь, что A-запись `materialhouse.ru` указывает на VPS:

   ```bash
   getent ahostsv4 materialhouse.ru
   ```

3. Если `www.materialhouse.ru` не настроен, в командах Certbot используйте только
   `materialhouse.ru`.

## 1. Подключение и резервная копия старого приложения

Подключитесь к серверу, используя новый пароль или SSH-ключ:

```bash
ssh root@SERVER_IP
```

Даже если старые данные больше не нужны, сделайте одноразовую страховочную копию:

```bash
mkdir -p /root/backup-before-rf4
tar -czf /root/backup-before-rf4/old-app.tar.gz \
  /var/www/dip30.12 /etc/nginx/sites-available/default 2>/dev/null || true
sudo -u postgres pg_dump materialhousedb \
  > /root/backup-before-rf4/materialhousedb.sql 2>/dev/null || true
```

Проверьте, что файлы созданы:

```bash
ls -lh /root/backup-before-rf4
```

## 2. Остановка и удаление старого приложения

```bash
pm2 list || true
pm2 delete all || true
pm2 save --force || true

rm -rf /var/www/dip30.12
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-available/default
```

Удалите старую БД и роль только после проверки резервной копии:

```bash
sudo -u postgres dropdb --if-exists materialhousedb
sudo -u postgres dropuser --if-exists danil
```

## 3. Обновление системы и пакеты

Для Vite 8 используйте Node.js 22. Node.js 20 подходит только начиная с 20.19.

```bash
apt update
DEBIAN_FRONTEND=noninteractive apt upgrade -y
apt install -y ca-certificates curl gnupg git nginx postgresql postgresql-contrib \
  certbot python3-certbot-nginx ufw

curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

node --version
npm --version
psql --version
nginx -v
```

Включите PostgreSQL и Nginx:

```bash
systemctl enable --now postgresql nginx
```

## 4. Отдельный пользователь приложения и клонирование

```bash
id rf4 >/dev/null 2>&1 || useradd --system --user-group \
  --home-dir /var/www/rf4 --shell /usr/sbin/nologin rf4

git clone --depth 1 --branch codex/deployment --single-branch \
  https://github.com/Danildanil228/project.git /var/www/rf4

chown -R rf4:rf4 /var/www/rf4
```

Если репозиторий станет приватным, используйте deploy key или GitHub token. Не
сохраняйте пароль GitHub в URL репозитория.

## 5. Новая PostgreSQL база

Сгенерируйте случайные секреты. Hex используется, чтобы значения безопасно
записывались в `.env` без дополнительного экранирования.

```bash
DB_PASSWORD="$(openssl rand -hex 24)"
BETTER_AUTH_SECRET="$(openssl rand -hex 48)"

sudo -u postgres psql <<SQL
CREATE ROLE rf4_app LOGIN PASSWORD '${DB_PASSWORD}';
CREATE DATABASE rf4db OWNER rf4_app;
\connect rf4db
GRANT ALL ON SCHEMA public TO rf4_app;
ALTER SCHEMA public OWNER TO rf4_app;
SQL
```

## 6. Production `.env`

Создайте файл, не добавляя его в Git:

```bash
install -o rf4 -g rf4 -m 600 /dev/null /var/www/rf4/back/.env

cat > /var/www/rf4/back/.env <<EOF
DB_USER=rf4_app
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=rf4db

BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
BETTER_AUTH_URL=https://materialhouse.ru
BETTER_AUTH_ADMIN_USER_IDS=

HOST=127.0.0.1
PORT=3000
PUBLIC_API_URL=https://materialhouse.ru
FRONTEND_ORIGINS=https://materialhouse.ru

DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
VK_CLIENT_ID=
VK_CLIENT_SECRET=
EOF

chown rf4:rf4 /var/www/rf4/back/.env
chmod 600 /var/www/rf4/back/.env
```

Не добавляйте `DB_SSL=true`: PostgreSQL находится на том же сервере и текущий
клиент проекта использует локальное соединение без SSL.

Если будет использоваться `www.materialhouse.ru`, добавьте его через запятую:

```dotenv
FRONTEND_ORIGINS=https://materialhouse.ru,https://www.materialhouse.ru
```

## 7. Установка зависимостей и сборка

Backend:

```bash
cd /var/www/rf4/back
sudo -u rf4 npm ci --omit=dev
sudo -u rf4 npm run migrate
```

Frontend использует относительные пути `/api`, поэтому `VITE_API_URL` и
frontend `.env` не нужны:

```bash
cd /var/www/rf4/front
sudo -u rf4 npm ci
sudo -u rf4 npm run build
```

Создайте каталог загрузок:

```bash
install -d -o rf4 -g rf4 -m 750 /var/www/rf4/back/uploads
```

## 8. systemd для backend

```bash
cp /var/www/rf4/deploy/rf4-api.service /etc/systemd/system/rf4-api.service
systemctl daemon-reload
systemctl enable --now rf4-api
```

Проверка:

```bash
systemctl status rf4-api --no-pager
journalctl -u rf4-api -n 100 --no-pager
curl --fail http://127.0.0.1:3000/health
```

Ожидаемый ответ health endpoint:

```json
{"status":"ok"}
```

## 9. Nginx

```bash
cp /var/www/rf4/deploy/materialhouse.ru.nginx \
  /etc/nginx/sites-available/materialhouse.ru
ln -sfn /etc/nginx/sites-available/materialhouse.ru \
  /etc/nginx/sites-enabled/materialhouse.ru

nginx -t
systemctl reload nginx
```

Важное отличие от старого конфига: у `proxy_pass` нет завершающего `/`. Иначе
Nginx удалит префикс `/api`, и маршруты backend перестанут совпадать.

Проверьте HTTP до выпуска сертификата:

```bash
curl -I http://materialhouse.ru
curl --fail http://materialhouse.ru/api/auth-providers
```

## 10. HTTPS

Только основной домен:

```bash
certbot --nginx -d materialhouse.ru --redirect
```

Основной домен и `www`, если обе DNS-записи уже существуют:

```bash
certbot --nginx -d materialhouse.ru -d www.materialhouse.ru --redirect
```

Проверьте сертификат и автоматическое обновление:

```bash
certbot renew --dry-run
curl --fail https://materialhouse.ru/api/auth-providers
curl -I https://materialhouse.ru
```

## 11. Firewall

Сначала обязательно разрешите SSH, только потом включайте firewall:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status verbose
```

Порт `3000` открывать не нужно: backend слушает только `127.0.0.1`.

## 12. Первый супер-администратор

На новой БД ID пользователя заранее неизвестен.

1. Откройте `https://materialhouse.ru` и зарегистрируйте первый аккаунт.
2. Пока реальная почта не подключена, ссылка подтверждения появится в логах:

   ```bash
   journalctl -u rf4-api -f
   ```

3. Перейдите по URL из строки `[auth-email:verification]`.
4. Получите ID подтверждённого пользователя:

   ```bash
   sudo -u postgres psql -d rf4db -c \
     'SELECT id, email, "emailVerified", role FROM "user" ORDER BY "createdAt";'
   ```

5. Запишите ID без кавычек в `/var/www/rf4/back/.env`:

   ```dotenv
   BETTER_AUTH_ADMIN_USER_IDS=ID_ПОЛЬЗОВАТЕЛЯ
   ```

6. Перезапустите backend:

   ```bash
   systemctl restart rf4-api
   systemctl status rf4-api --no-pager
   ```

## 13. OAuth, если будет включён

При заполнении Discord/VK credentials callback URL должен быть:

```text
https://materialhouse.ru/api/auth/callback/discord
https://materialhouse.ru/api/auth/callback/vk
```

После изменения `.env` перезапустите `rf4-api`.

## 14. Обновление приложения

```bash
cd /var/www/rf4
sudo -u rf4 git fetch origin
sudo -u rf4 git checkout codex/deployment
sudo -u rf4 git pull --ff-only origin codex/deployment

cd /var/www/rf4/back
sudo -u rf4 npm ci --omit=dev
sudo -u rf4 npm run migrate

cd /var/www/rf4/front
sudo -u rf4 npm ci
sudo -u rf4 npm run build

systemctl restart rf4-api
nginx -t && systemctl reload nginx

curl --fail https://materialhouse.ru/api/auth-providers
systemctl status rf4-api --no-pager
```

## 15. Резервные копии

Минимальная ручная резервная копия состоит из PostgreSQL и каталога uploads:

```bash
mkdir -p /var/backups/rf4
sudo -u postgres pg_dump -Fc rf4db \
  > /var/backups/rf4/rf4db-$(date +%F-%H%M).dump
tar -czf /var/backups/rf4/uploads-$(date +%F-%H%M).tar.gz \
  -C /var/www/rf4/back uploads
```

Копии необходимо периодически переносить за пределы VPS.

## 16. Диагностика

```bash
systemctl status rf4-api --no-pager
journalctl -u rf4-api -n 200 --no-pager
journalctl -u nginx -n 100 --no-pager
nginx -t
ss -lntp | grep -E ':80|:443|:3000|:5432'
sudo -u postgres psql -d rf4db -c 'SELECT id, "appliedAt" FROM "appMigration" ORDER BY id;'
```

Ожидается:

- `80/443` доступны снаружи через Nginx;
- `3000` слушает только `127.0.0.1`;
- `5432` не открыт в интернет;
- миграции `001`-`010` присутствуют в `appMigration`.

## 17. Усиление SSH после успешного деплоя

Добавьте SSH-ключ и проверьте вход в отдельном терминале. Только после этого
отключайте парольный вход и прямой root login в `/etc/ssh/sshd_config.d/`:

```text
PasswordAuthentication no
PermitRootLogin prohibit-password
```

Проверка и применение:

```bash
sshd -t && systemctl reload ssh
```
