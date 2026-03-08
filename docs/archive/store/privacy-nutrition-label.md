# Apple Privacy Nutrition Label — Terra Gacha

**App Store Connect path**: App Record → App Privacy → Privacy Practices

This document declares every data type the app collects, per Apple's App Privacy requirement.
Translate the tables below directly into the App Store Connect checkboxes.

---

## Data Used to Track You

> "Tracking" in Apple's definition means linking data to a third-party identity or sharing data with data brokers.

**None.** Terra Gacha does not use cross-app tracking. No IDFA-dependent advertising calls are made. The ATT consent prompt (38.3.4) appears on iOS 14.5+ but the answer does not change what data is collected — it gates analytics events that would otherwise leave the app.

Select: **No data used to track you.**

---

## Data Linked to You

These data types are collected and linked to the user's identity (account).

| Data Type | Specific Data | Usage Purpose | Optional? |
|---|---|---|---|
| Contact Info | Email Address | Account authentication, account recovery, password reset | No — required to create or log in to an account |
| Identifiers | User ID | Authentication token validation, cloud save sync, analytics | No |
| Purchases | Purchase History | IAP restoration (StoreKit), subscription status verification | No — required for subscription features |
| Usage Data | Product Interaction | Analytics (session events, quiz answers, dive completions), in-app personalization | Yes — gated behind ATT consent on iOS |
| Diagnostics | Crash Data | Bug detection and app stability improvements | Yes — can be disabled in Settings |

**App Store Connect checkboxes to select under "Data Linked to You"**:
- [x] Contact Info → Email Address → App Functionality, Developer's Advertising or Marketing
- [x] Identifiers → User ID → App Functionality, Analytics
- [x] Purchases → Purchase History → App Functionality
- [x] Usage Data → Product Interaction → Analytics, App Functionality
- [x] Diagnostics → Crash Data → App Functionality

---

## Data Not Linked to You

These data types are collected anonymously and not associated with any user account.

| Data Type | Specific Data | Usage Purpose |
|---|---|---|
| Performance Data | Performance Metrics | Monitoring app load times, frame rates, and server response times for optimization |
| Diagnostics | Other Diagnostic Data | Aggregated crash frequency metrics (not symbolicated to individual users) |

**App Store Connect checkboxes to select under "Data Not Linked to You"**:
- [x] Performance Data → Performance Metrics → App Functionality
- [x] Diagnostics → Other Diagnostic Data → App Functionality

---

## Data Not Collected

The following sensitive data types are NOT collected by Terra Gacha:

- Health & Fitness data
- Financial information (card numbers, bank accounts — IAP handled by StoreKit/Apple)
- Precise or coarse location
- Sensitive info (racial or ethnic data, religious beliefs, sexual orientation)
- Contacts (address book)
- Browsing history
- Search history
- Microphone or audio data
- Photos, videos, or files (camera and photo library permissions are declared for future avatar features — no data is uploaded unless the user explicitly uploads a photo)

---

## Privacy Policy URL

**https://terragacha.com/privacy**

The privacy policy must be live and accessible from a web browser before App Store submission. It must cover all data types listed above and describe:
1. What data is collected
2. Why it is collected
3. How it is used
4. How users can request deletion (DELETE account endpoint at POST /api/account/delete)
5. Third parties data is shared with (none for IDFA; RevenueCat receives purchase data)

---

## Notes for App Store Review

- Terra Gacha does **not** use advertising networks or share data with data brokers.
- The ATT prompt (NSUserTrackingUsageDescription) is shown because analytics events are fired that could theoretically be used for cross-app measurement. However, no IDFA is read. The prompt satisfies Apple's requirement to ask before any data collection that could be "tracking" in the broad sense.
- Email authentication is the only contact info collected. No marketing emails are sent without explicit opt-in.
- All delete-account requests wipe user data within 30 days per GDPR/COPPA compliance.
