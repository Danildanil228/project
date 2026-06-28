# Простой перенос проекта на новый Ubuntu VPS

Исходные данные:

- старый IP: `139.100.205.24`;
- домен: `materialhouse.ru`;
- база данных: `project`;
- backup базы: `C:\Users\danil\Desktop\dump-project-202606281541.sql`;
- uploads: `C:\Users\danil\Desktop\project\back\uploads`;
- production-ветка: `codex/deployment`.

Файл backup имеет расширение `.sql`, но фактически это бинарный архив PostgreSQL
18 (`PGDMP`). Поэтому восстанавливать его нужно командой `pg_restore`, а на новый
Ubuntu установить PostgreSQL 18.

## 1. Сохранить production `.env` со старого сервера

В PowerShell на ПК:

```powershell
scp root@139.100.205.24:/var/www/rf4/back/.env `
  C:\Users\danil\Desktop\production.env
```

В этом файле находятся `BETTER_AUTH_SECRET`, ID супер-администратора и ключи
подключённых сервисов. Новый секрет создавать не нужно.

## 2. Купить новый VPS и подключиться

Выберите Ubuntu 24.04. После создания сервера:

```bash
ssh root@NEW_IP
```

## 3. Установить программы

```bash
apt update && apt upgrade -y

apt install -y curl ca-certificates git nginx certbot \
  python3-certbot-nginx postgresql-common

# PostgreSQL 18
/usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
apt update
apt install -y postgresql-18 postgresql-contrib

systemctl start postgresql
systemctl enable postgresql

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# PM2
npm install -g pm2

systemctl start nginx
systemctl enable nginx

node -v
npm -v
psql --version
nginx -v
```

## 4. Создать базу PostgreSQL

Используйте тот же пароль, который указан в `production.env` в
`DB_PASSWORD`. Вместо `YOUR_DB_PASSWORD` вставьте его значение.

```bash
runuser -u postgres -- psql << EOF
ALTER USER postgres WITH PASSWORD 'YOUR_DB_PASSWORD';
CREATE DATABASE project OWNER postgres;
EOF
```

## 5. Клонировать проект

```bash
mkdir -p /var/www
cd /var/www

git clone --branch codex/deployment --single-branch \
  https://github.com/Danildanil228/project.git rf4
```

## 6. Загрузить `.env`, backup и uploads с ПК

Эти команды выполняются в PowerShell на вашем ПК. Вместо `NEW_IP` укажите IP
нового сервера.

```powershell
scp C:\Users\danil\Desktop\production.env `
  root@NEW_IP:/var/www/rf4/back/.env

scp C:\Users\danil\Desktop\dump-project-202606281541.sql `
  root@NEW_IP:/root/project.dump

scp -r C:\Users\danil\Desktop\project\back\uploads `
  root@NEW_IP:/var/www/rf4/back/
```

## 7. Проверить `.env`

Снова подключитесь к новому серверу:

```bash
ssh root@NEW_IP
nano /var/www/rf4/back/.env
```

Проверьте эти строки:

```dotenv
DB_USER=postgres
DB_PASSWORD=YOUR_DB_PASSWORD
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=project

BETTER_AUTH_URL=https://materialhouse.ru
PUBLIC_API_URL=https://materialhouse.ru
FRONTEND_ORIGINS=https://materialhouse.ru

HOST=127.0.0.1
PORT=3000
```

Остальные секреты и настройки оставьте такими же, как на старом сервере.

```bash
chmod 600 /var/www/rf4/back/.env
```

## 8. Восстановить базу

Вместо `YOUR_DB_PASSWORD` укажите пароль из `.env`:

```bash
PGPASSWORD='YOUR_DB_PASSWORD' pg_restore \
  -h 127.0.0.1 \
  -U postgres \
  -d project \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  /root/project.dump
```

Проверка:

```bash
PGPASSWORD='YOUR_DB_PASSWORD' psql -h 127.0.0.1 -U postgres -d project \
  -c 'SELECT count(*) AS users FROM "user";'
```

## 9. Запустить backend

```bash
cd /var/www/rf4/back
npm install
npm run migrate

pm2 start npm --name rf4-api -- start
pm2 save
pm2 startup
```

После `pm2 startup` терминал покажет ещё одну команду. Выполните её, затем:

```bash
pm2 save
pm2 status
curl http://127.0.0.1:3000/health
```

Ожидаемый ответ:

```json
{"status":"ok"}
```

## 10. Собрать frontend

```bash
cd /var/www/rf4/front
npm install
npm run build
```

Frontend `.env` создавать не нужно: проект использует пути `/api` и `/uploads`.

## 11. Настроить Nginx

В проекте уже лежит готовая конфигурация:

```bash
rm -f /etc/nginx/sites-enabled/default

cp /var/www/rf4/deploy/materialhouse.ru.nginx \
  /etc/nginx/sites-available/materialhouse.ru

ln -s /etc/nginx/sites-available/materialhouse.ru \
  /etc/nginx/sites-enabled/materialhouse.ru

nginx -t
systemctl restart nginx
```

До переключения домена откройте в браузере:

```text
http://NEW_IP
```

И проверьте API на сервере:

```bash
curl -H 'Host: materialhouse.ru' http://127.0.0.1/api/auth-providers
```

## 12. Переключить домен на новый IP

В панели Selectel откройте DNS-зону `materialhouse.ru` и измените A-запись:

```text
Было: 139.100.205.24
Стало: NEW_IP
```

Никакой отдельной отвязки домена от старого сервера нет. Домен указывает на сервер
только через A-запись DNS.

Проверка с ПК:

```powershell
Resolve-DnsName materialhouse.ru -Type A
```

Команда должна показать новый IP.

## 13. Подключить HTTPS

Когда DNS уже показывает новый IP, выполните на новом сервере:

```bash
certbot --nginx -d materialhouse.ru --redirect
nginx -t
systemctl restart nginx
```

Проверка:

```bash
curl https://materialhouse.ru/api/auth-providers
```

## 14. Что проверить перед удалением старого VPS

- сайт открывается с ПК, Android и iPhone;
- работает вход;
- открываются фотографии, карты и 3D-модели;
- работает создание поста и загрузка фотографии;
- работает админ-панель;
- `pm2 status` показывает `rf4-api` со статусом `online`;
- `https://materialhouse.ru/api/auth-providers` возвращает JSON.

Старый сервер удаляйте только после этих проверок. DNS уже будет указывать на новый
IP, поэтому перед удалением старого VPS больше ничего отвязывать не потребуется.
