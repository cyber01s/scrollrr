# Scrollrr - Best Practices for Real Affiliate Products

## Architecture Overview

The app uses a **secure, optimized, server-side data fetching model** that best practices for affiliate product platforms:

```
Frontend (React)          Vercel Serverless         Impact.com API
     ↓                           ↓                         ↓
  /api/feed         →  [Memory Cache]  →  [Retry Logic]  →  Real Products
                           ↓
                       Normalize & Filter
                           ↓
                       JSON Response
```

## Best Practices Implemented

### 1. **Secure Credential Management**
- ✅ Credentials stored in Vercel environment variables (not in code)
- ✅ All API calls made server-side (no exposure to browser)
- ✅ No hardcoded tokens or API keys in codebase
- ✅ Credentials never sent to client JavaScript

**Why:** Prevents credential theft and API abuse.

### 2. **Smart Caching Strategy**
- ✅ **In-Memory Cache**: Vercel stores recent page results (2-hour TTL)
- ✅ **Page-Based**: Each page cached separately (page 0, 1, 2...)
- ✅ **Automatic Expiration**: Stale data automatically refreshed after 2 hours
- ✅ **Cache Bypass**: Different pages load fresh data (infinite scroll)

**Why:** Prevents API rate limits, reduces latency, improves user experience.

### 3. **Intelligent Retry Logic**
```
Request to Impact.com
    ↓
If failed (but not auth/rate limit):
    Wait 500ms → Retry
    ↓
If failed again:
    Wait 1000ms → Retry
    ↓
If still failed:
    Return empty array (never expose error to user)
```

- ✅ Exponential backoff: 500ms → 1000ms
- ✅ Max 2 retries per request
- ✅ Stops immediately on:
  - 401/403 (auth failed)
  - 429 (rate limited)
  - Timeout

**Why:** Handles temporary network failures without wasting API quota.

### 4. **Timeout Protection**
- ✅ Per-request timeout: 4 seconds
- ✅ Overall timeout: 15 seconds for all API calls
- ✅ AbortController prevents hanging requests

**Why:** Ensures responses complete quickly, prevents server overload.

### 5. **Product Normalization**
Raw Impact.com data → Normalized format:
```javascript
{
  id: "unique-id",
  name: "Product Name",
  category: "Tech",
  imageUrl: "https://...",
  price: 299.99,
  originalPrice: 399.99,
  currency: "USD",
  rating: 4.5,
  reviewCount: 1250,
  affiliateUrl: "https://impact-tracking-url",  // Real affiliate link
  campaignId: "12345",
  sourceId: "partner-id"
}
```

**Why:** Ensures consistent data format across all sources.

### 6. **Affiliate URL Management**
- ✅ Uses Impact.com native tracking URLs when available
- ✅ Falls back to sjv.io wrapper for non-tracked URLs
- ✅ Includes partner property ID for attribution
- ✅ Validates URLs before returning

**Why:** Ensures affiliate commissions are properly tracked.

### 7. **Graceful Error Handling**
- ✅ Never returns 500 errors to client
- ✅ Always returns 200 OK with empty array on failure
- ✅ Detailed server-side logging for debugging
- ✅ Diagnostic endpoint for troubleshooting

**Why:** Prevents app from breaking, users see "loading" then empty (not error).

### 8. **CORS & Security**
- ✅ Proper CORS headers on all endpoints
- ✅ Only GET requests allowed for public endpoints
- ✅ OPTIONS preflight support
- ✅ Request validation

**Why:** Secure cross-origin requests, prevents unauthorized methods.

## Performance Metrics

| Operation | Time | Notes |
|-----------|------|-------|
| Cache Hit | <50ms | Memory cache return |
| First Request | 1-4s | Impact.com API fetch + normalize |
| Retry (1st) | 1-4s + 500ms wait | Exponential backoff |
| Timeout | 4-15s | Aborted after timeout |
| 2nd Page Load | <50ms | From cache (if within 2 hours) |

## Caching Timeline

```
12:00 PM - User loads page 0
           → API fetches from Impact.com (3 seconds)
           → Cached for 2 hours

12:05 PM - Same user loads page 0 again
           → Returns from cache instantly (<50ms)

12:30 PM - Different user loads page 0
           → Returns from cache instantly

02:00 PM - Cache expires
           → Next request fetches fresh from Impact.com
           → Cached again for 2 hours
```

## Scaling Considerations

### Current (Works for ~100 concurrent users):
- Single in-memory cache per Vercel instance
- No persistent storage needed
- Cold starts add ~1 second overhead

### For Larger Scale (1000+ concurrent users):
Consider:
1. **Redis Cache** (Upstash): Persistent cache across instances
2. **Database**: Store popular products in PostgreSQL
3. **CDN**: Cache product images on CDN
4. **Rate Limiting**: Implement per-IP rate limiting

### Environment Variables for Scale:
```env
UPSTASH_REDIS_URL=redis://...  # For distributed caching
DATABASE_URL=postgresql://...   # For product storage
```

## Monitoring & Debugging

### Check API Status
```bash
curl https://your-app.vercel.app/api/diagnostic
```

Expected response:
```json
{
  "credentials": {
    "hasImpactAccountSid": true,
    "hasImpactAuthToken": true,
    "hasImpactProgramId": true
  },
  "status": {
    "credentialsComplete": true,
    "message": "✅ All credentials configured"
  }
}
```

### View Vercel Logs
```bash
vercel logs scrollrr
```

Look for:
- `[Impact] ✓ Credentials loaded successfully`
- `[Feed] ✓ Returning X products from Impact.com`
- `[Cache] Memory hit for feed:page:0`

### Search Endpoint
```bash
curl "https://your-app.vercel.app/api/search?q=laptop"
```

### Specs Endpoint
```bash
curl "https://your-app.vercel.app/api/specs?id=product-id&name=Sony+WH1000XM5"
```

## Production Checklist

- [ ] ✅ All 3 Impact.com environment variables set on Vercel
- [ ] ✅ Verified in `/api/diagnostic` shows "✅ All credentials configured"
- [ ] ✅ App loads products on fresh deployment
- [ ] ✅ Affiliate URLs working (click test)
- [ ] ✅ Caching working (check Vercel logs for cache hits)
- [ ] ✅ No 500 errors in logs
- [ ] ✅ Infinite scroll loads next pages
- [ ] ✅ Search working (for integrated search)

## API Endpoints

| Endpoint | Method | Purpose | Cache |
|----------|--------|---------|-------|
| `/api/feed?page=0` | GET | Paginated products | 2 hours |
| `/api/search?q=laptop` | GET | Search products | 1 hour |
| `/api/specs?id=...&name=...` | GET/POST | Product specs | Runtime |
| `/api/diagnostic` | GET | Check credentials | No |

## Security Best Practices Recap

1. **Never commit credentials** - Use environment variables
2. **Validate all input** - Check page numbers, search queries
3. **Rate limit** - Prevent abuse (implement on scale)
4. **HTTPS only** - Vercel enforces this
5. **Server-side auth** - Never expose API keys to browser
6. **Error messages** - Don't expose internal errors to client

---

**Questions?** Check logs via `vercel logs scrollrr` or email support.
