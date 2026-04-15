<?php
/**
 * GET /api/deposits/pending.php
 * Verifica depósitos PENDING do usuário e credita os pagos.
 * Cada depósito é processado em sua própria transação com FOR UPDATE.
 * Depósitos com mais de 30 minutos PENDING são marcados como EXPIRED.
 */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/duttyfy.php';

setupHeaders();

$payload = requireAuth();
$userId = (int)$payload['sub'];

$db = getDB();

// Primeiro: expira depósitos PENDING com mais de 30 minutos
$db->prepare('UPDATE deposits SET status = "EXPIRED" WHERE user_id = ? AND status = "PENDING" AND credited = 0 AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)')
   ->execute([$userId]);

// Busca depósitos ainda pendentes (sem lock - só para listar IDs)
$stmt = $db->prepare('SELECT id, transaction_id FROM deposits WHERE user_id = ? AND status = "PENDING" AND credited = 0 ORDER BY created_at DESC LIMIT 10');
$stmt->execute([$userId]);
$pendingList = $stmt->fetchAll();

$credited = [];
$stillPending = [];

foreach ($pendingList as $row) {
    $depositId = (int)$row['id'];
    $txId = $row['transaction_id'];

    // Cada depósito em sua própria transação com lock
    $db->beginTransaction();
    try {
        // Lock de linha: impede crédito duplicado
        $stmt2 = $db->prepare('SELECT * FROM deposits WHERE id = ? AND credited = 0 FOR UPDATE');
        $stmt2->execute([$depositId]);
        $deposit = $stmt2->fetch();

        // Se não encontrou (já foi creditado por outro processo), pula
        if (!$deposit) {
            $db->rollBack();
            continue;
        }

        // Consulta Duttyfy
        $result = duttyfyRequest('GET', '?transactionId=' . urlencode($txId));
        $newStatus = $result['status'] ?? 'PENDING';
        $paidAt = $result['paidAt'] ?? null;

        if ($newStatus === 'COMPLETED') {
            $amount = (float)$deposit['amount'];

            $db->prepare('UPDATE deposits SET status = "COMPLETED", paid_at = ?, credited = 1 WHERE id = ?')
               ->execute([$paidAt, $depositId]);

            $db->prepare('UPDATE users SET balance = balance + ? WHERE id = ?')
               ->execute([$amount, $userId]);

            $db->prepare('INSERT INTO transactions (user_id, type, method, value, reason, date) VALUES (?, "deposit", "pix", ?, ?, ?)')
               ->execute([$userId, $amount, 'Depósito via PIX #' . $txId, date('d/m/Y')]);

            $db->commit();

            $credited[] = [
                'transactionId' => $txId,
                'amount' => $amount,
                'paidAt' => $paidAt
            ];
        } else {
            // Não foi pago ainda
            $db->commit();
            $stillPending[] = [
                'transactionId' => $txId,
                'amount' => (float)$deposit['amount'],
                'createdAt' => $deposit['created_at']
            ];
        }
    } catch (Exception $e) {
        $db->rollBack();
    }
}

echo json_encode([
    'credited' => $credited,
    'pending' => $stillPending,
    'totalCredited' => count($credited)
]);
