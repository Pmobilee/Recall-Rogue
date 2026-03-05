# Webhooks

Receive real-time notifications when content events occur in the Terra Gacha ecosystem.

## Supported Events

| Event | Description |
|-------|-------------|
| `ugc.submitted` | A new community fact submission was received |
| `ugc.approved` | A submission was approved by a moderator |
| `ugc.rejected` | A submission was rejected by auto-filter or moderator |
| `ugc.ready_for_review` | A submission passed community voting and needs admin review |
| `fact.updated` | An existing approved fact was edited |
| `fact.deleted` | An approved fact was removed from the database |

## Registering a Webhook

```bash
curl -X POST https://api.terragacha.com/api/webhooks \
  -H "X-Api-Key: tg_live_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "endpointUrl": "https://yourserver.com/webhooks/terra-gacha",
    "events": ["ugc.approved", "fact.updated"]
  }'
```

Response:
```json
{
  "subscriptionId": "uuid-here",
  "secret": "64-char-hex-secret",
  "events": ["ugc.approved", "fact.updated"],
  "endpointUrl": "https://yourserver.com/webhooks/terra-gacha"
}
```

**Store the `secret` securely** — it is shown only once and is used to verify HMAC signatures.

## Verifying Signatures

Every delivery includes an `X-TerraGacha-Signature` header:
```
X-TerraGacha-Signature: sha256=abc123...
```

Verify it server-side using the subscription secret:

```js
const crypto = require('crypto')
function verifySignature(body, secret, signatureHeader) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
}

// In your webhook handler (Express example):
app.post('/webhooks/terra-gacha', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-terragacha-signature']
  if (!verifySignature(req.body, process.env.WEBHOOK_SECRET, sig)) {
    return res.status(401).send('Invalid signature')
  }
  const payload = JSON.parse(req.body)
  console.log('Event:', payload.event)
  res.status(200).send('OK')
})
```

## Payload Structure

All events share the same envelope:

```json
{
  "event": "ugc.approved",
  "timestamp": "2026-03-05T12:34:56.789Z",
  "data": {
    "submissionId": "ugc-1709500800000-abc123"
  }
}
```

## Retry Policy

If your endpoint returns a non-2xx status or times out (10s), delivery is retried:

| Attempt | Delay |
|---------|-------|
| 1st retry | +10 seconds |
| 2nd retry | +30 seconds |
| 3rd retry | +2 minutes |
| 4th retry | +10 minutes |
| Final failure | Dropped (logged server-side) |

## Subscription Limits

Maximum **5 active webhook subscriptions** per API key.
Each subscription can listen to multiple events in a single registration call.

## Deleting a Webhook

```bash
curl -X DELETE https://api.terragacha.com/api/webhooks/{subscriptionId} \
  -H "X-Api-Key: tg_live_your_key_here"
```
