<?php

namespace Cpaas;

class Client
{
    private string $apiKey;
    private string $baseUrl;

    public function __construct(string $apiKey, string $baseUrl = 'http://localhost:3001')
    {
        $this->apiKey = $apiKey;
        $this->baseUrl = rtrim($baseUrl, '/');
    }

    private function request(string $method, string $path, ?array $body = null): array
    {
        $ch = curl_init($this->baseUrl . '/v1' . $path);
        $headers = [
            'Content-Type: application/json',
            'X-Api-Key: ' . $this->apiKey,
        ];
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 30,
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }
        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($raw === false) {
            throw new \RuntimeException(curl_error($ch));
        }
        curl_close($ch);
        $data = json_decode($raw, true) ?? [];
        if ($status >= 300) {
            $message = $data['error']['message'] ?? $raw;
            throw new \RuntimeException($message);
        }
        return $data;
    }

    public function verifySend(string $to, string $channel = 'SMS'): array
    {
        return $this->request('POST', '/verify/send', ['to' => $to, 'channel' => $channel]);
    }

    public function verifyCheck(string $id, string $code): array
    {
        return $this->request('POST', '/verify/check', ['id' => $id, 'code' => $code]);
    }

    public function messagesCreate(string $to, string $body): array
    {
        return $this->request('POST', '/messages', ['to' => $to, 'body' => $body]);
    }
}
