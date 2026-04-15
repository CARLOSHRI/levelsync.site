# Configuração do Sistema de Notificações Push

## 1. Instalar dependências

```bash
composer install
```

## 2. Gerar chaves VAPID

```bash
php api/scripts/generate-vapid.php
```

Isso cria o arquivo `api/_vapid_keys.json` com as chaves necessárias para Web Push.

## 3. Executar migration do banco

```bash
php api/scripts/run-migration-push.php
```

Ou execute manualmente o SQL em `api/sql/migration_push_notifications.sql`.

## 4. Configurar cron (opcional)

Para enviar notificações agendadas e recorrentes automaticamente, adicione ao crontab:

```
* * * * * php /caminho/para/api/cron/send-scheduled-notifications.php
```

(Executa a cada minuto)

## 5. Admin com senha

O painel admin agora usa login com e-mail e senha. Certifique-se de que o usuário admin tenha uma senha definida no banco (campo `password_hash`).

Para criar/atualizar senha de admin via PHP:
```php
<?php
echo password_hash('suasenha', PASSWORD_BCRYPT);
// Cole o resultado no UPDATE users SET password_hash='...' WHERE email='admin@...';
```
