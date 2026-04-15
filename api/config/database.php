<?php
/**
 * LotoGrana - Configuração do Banco de Dados
 * Conexão PDO com MySQL
 */

define('DB_HOST', '62.171.170.68');
define('DB_NAME', 'blac_lotograna');
define('DB_USER', 'blac_lotograna');
define('DB_PASS', 'ufquwcPmEkDrvMvo');
define('DB_CHARSET', 'utf8mb4');

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    }
    return $pdo;
}
