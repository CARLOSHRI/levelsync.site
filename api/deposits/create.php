<?php
/**
 * POST /api/deposits/create.php
 * Gera um PIX via Duttyfy e registra depósito pendente
 * Body: { amount, customer: { name, email } }
 * CPF e telefone são gerados automaticamente pelo servidor.
 */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/duttyfy.php';

setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

$payload = requireAuth();
$userId = (int)$payload['sub'];
$input = json_decode(file_get_contents('php://input'), true);

// Valor em reais (frontend envia em reais)
$amountReais = (float)($input['amount'] ?? 0);
if ($amountReais < 1) {
    http_response_code(400);
    echo json_encode(['error' => 'Valor mínimo de R$ 1,00']);
    exit;
}

// Cancela depósitos PENDING antigos do mesmo usuário (evita acumular pendentes)
$db = getDB();
$db->prepare('UPDATE deposits SET status = "EXPIRED" WHERE user_id = ? AND status = "PENDING" AND credited = 0')
   ->execute([$userId]);

// Converte para centavos para a Duttyfy
$amountCentavos = (int)round($amountReais * 100);

// Nome e email vêm do frontend; CPF e telefone são gerados automaticamente
$customer = $input['customer'] ?? [];
$customerName = trim($customer['name'] ?? '');
$customerEmail = trim($customer['email'] ?? '');

// Se não veio nome/email, busca do banco
if (empty($customerName) || empty($customerEmail)) {
    $stmtUser = $db->prepare('SELECT name, email FROM users WHERE id = ?');
    $stmtUser->execute([$userId]);
    $userData = $stmtUser->fetch();
    if (empty($customerName)) $customerName = $userData['name'] ?? 'Cliente';
    if (empty($customerEmail)) $customerEmail = $userData['email'] ?? 'cliente@email.com';
}

// Gera CPF válido aleatoriamente
function generateValidCPF() {
    $cpf = [];
    for ($i = 0; $i < 9; $i++) {
        $cpf[] = rand(0, 9);
    }
    // Primeiro dígito verificador
    $sum = 0;
    for ($i = 0; $i < 9; $i++) {
        $sum += $cpf[$i] * (10 - $i);
    }
    $rest = $sum % 11;
    $cpf[] = ($rest < 2) ? 0 : (11 - $rest);
    // Segundo dígito verificador
    $sum = 0;
    for ($i = 0; $i < 10; $i++) {
        $sum += $cpf[$i] * (11 - $i);
    }
    $rest = $sum % 11;
    $cpf[] = ($rest < 2) ? 0 : (11 - $rest);
    return implode('', $cpf);
}

// Gera telefone válido aleatoriamente (DDD + 9 + 8 dígitos)
function generateValidPhone() {
    $ddds = [11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99];
    $ddd = $ddds[array_rand($ddds)];
    $number = '9' . str_pad(rand(10000000, 99999999), 8, '0', STR_PAD_LEFT);
    return $ddd . $number;
}

$customerDoc = generateValidCPF();
$customerPhone = generateValidPhone();

// Chama a API da Duttyfy para gerar o PIX
$duttyfyBody = [
    'amount' => $amountCentavos,
    'description' => 'Depósito LotoGrana - R$ ' . number_format($amountReais, 2, ',', '.'),
    'customer' => [
        'name' => $customerName,
        'document' => $customerDoc,
        'email' => $customerEmail,
        'phone' => $customerPhone
    ],
    'item' => [
        'title' => 'Depósito LotoGrana',
        'price' => $amountCentavos,
        'quantity' => 1
    ],
    'paymentMethod' => 'PIX'
];

$result = duttyfyRequest('POST', '', $duttyfyBody);

if (isset($result['error'])) {
    http_response_code(400);
    echo json_encode(['error' => $result['error']]);
    exit;
}

$pixCode = $result['pixCode'] ?? '';
$transactionId = $result['transactionId'] ?? '';

if (empty($transactionId)) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao gerar PIX: transactionId não retornado']);
    exit;
}

// Salva no banco de dados
$stmt = $db->prepare('INSERT INTO deposits (user_id, transaction_id, amount, status, pix_code, credited) VALUES (?, ?, ?, "PENDING", ?, 0)');
$stmt->execute([$userId, $transactionId, $amountReais, $pixCode]);

echo json_encode([
    'pixCode' => $pixCode,
    'transactionId' => $transactionId,
    'amount' => $amountReais,
    'status' => 'PENDING',
    'depositId' => (int)$db->lastInsertId()
]);
