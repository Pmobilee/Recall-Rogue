# Partner Portal

Educational institutions can apply for free Institutional API access through the Partner Portal.

## Registration

1. Visit [terragacha.com/partner](https://terragacha.com/partner) or navigate to
   `/partner` in the Recall Rogue app.
2. Fill in the registration form:
   - Organization name
   - Domain (e.g. `school.edu`)
   - Organization type: K-12, University, Nonprofit, or EdTech
   - Contact name and email
3. Submit — you'll receive a reference ID immediately.
4. The Recall Rogue team reviews your application within 2 business days.
5. Upon approval, you receive an API key with **Institutional tier** quotas.

## API Registration (programmatic)

```bash
curl -X POST https://api.terragacha.com/api/partner/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Springfield Elementary School",
    "domain": "springfield.edu",
    "orgType": "k12",
    "contactEmail": "j.smith@springfield.edu",
    "contactName": "Dr. Jane Smith"
  }'
```

Response:
```json
{
  "partnerId": "uuid-here",
  "status": "pending",
  "message": "Application received. You will be contacted within 2 business days."
}
```

## Dashboard

Once approved, access your dashboard with your issued API key:

```bash
curl https://api.terragacha.com/api/partner/dashboard \
  -H "X-Api-Key: tg_live_your_institutional_key"
```

Response includes:
- Organization details and tier
- Per-day and per-minute quota
- Usage breakdown by endpoint (last 7 days)

## Content Configuration

Partners can restrict content for their deployment:

```bash
curl -X PUT https://api.terragacha.com/api/partner/dashboard/config \
  -H "X-Api-Key: tg_live_your_institutional_key" \
  -H "Content-Type: application/json" \
  -d '{
    "ageRating": "teen",
    "categories": ["Biology", "History", "Geography"],
    "maxDifficulty": 4
  }'
```

| Config Field | Description |
|-------------|-------------|
| `ageRating` | Maximum content rating: `child`, `teen` (default), or `adult` |
| `categories` | Allowlist of category names; empty = all categories |
| `maxDifficulty` | Maximum difficulty level (1-5) |
