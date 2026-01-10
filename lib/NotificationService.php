<?php
// lib/NotificationService.php
// Simple DB-backed NotificationService. Use this to create notifications persisted in MySQL.

class NotificationService {
    protected $pdo;

    public function __construct(PDO $pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Create notifications for multiple recipients.
     * $recipients: array of user ids
     * $payload: [ type, title, body, data (assoc) ]
     * $actorId: id of user who triggered the notification (nullable)
     * Returns array of created notification IDs.
     */
    public function notify(array $recipients, array $payload, $actorId = null) {
        $created = [];
        $stmt = $this->pdo->prepare("INSERT INTO notifications (recipient_id, actor_id, type, title, body, data, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
        foreach ($recipients as $recipientId) {
            $dataJson = isset($payload['data']) ? json_encode($payload['data']) : null;
            $stmt->execute([
                $recipientId,
                $actorId,
                $payload['type'],
                $payload['title'] ?? null,
                $payload['body'] ?? null,
                $dataJson
            ]);
            $created[] = (int)$this->pdo->lastInsertId();
        }
        return $created;
    }
}
