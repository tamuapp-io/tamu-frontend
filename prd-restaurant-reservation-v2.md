# Restaurant Booking Engine — Full PRD v1.0

**Stack:** Laravel + Next.js  
**Version:** 1.0 — Complete  
**Date:** April 2026

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [User Personas](#2-user-personas)
3. [Booking Engine (Core)](#3-booking-engine-core)
4. [Table & Floor Management](#4-table--floor-management)
5. [Guest Booking Flow](#5-guest-booking-flow)
6. [Reservation State Machine](#6-reservation-state-machine)
7. [Waitlist System](#7-waitlist-system)
8. [Notifications & Reminders](#8-notifications--reminders)
9. [Guest CRM](#9-guest-crm)
10. [Deposits & Payments](#10-deposits--payments)
11. [Staff & Owner Dashboard](#11-staff--owner-dashboard)
12. [Reports & Analytics](#12-reports--analytics)
13. [Multi-Tenancy & Settings](#13-multi-tenancy--settings)
14. [Database Schema](#14-database-schema)
15. [API Reference](#15-api-reference)
16. [Tech Stack](#16-tech-stack)
17. [Roadmap](#17-roadmap)
18. [Pricing Tiers](#18-pricing-tiers)
19. [Non-Functional Requirements](#19-non-functional-requirements)
20. [Risks & Mitigations](#20-risks--mitigations)

---

## 1. Overview & Goals

A multi-tenant SaaS platform enabling restaurants to manage table reservations, walk-ins, waitlists, and the full guest experience digitally. Restaurant operators get a powerful management suite; diners get a frictionless booking flow via web widget or direct link.

> **Problem Statement**  
> Most restaurants in the SEA market still rely on WhatsApp or phone calls for reservations — no confirmation system, no capacity management, no guest data. This platform replaces that friction with a structured, automated, and data-driven system.

### Core Goals

| Goal | Type | Description |
|---|---|---|
| Zero double bookings | Operator | DB-level locking prevents concurrent booking conflicts on the same table/slot |
| Reduce no-shows | Operator | Automated WhatsApp & email reminders at 24h and 1h before reservation |
| Maximize capacity | Operator | Live availability view, auto waitlist promotion, and floor plan optimization |
| Scalable SaaS | Business | Onboard new tenants without infrastructure changes; freemium to paid funnel |

---

## 2. User Personas

| Persona | Role | Primary Use | Key Needs |
|---|---|---|---|
| Restaurant Owner | `Owner` | Setup, settings, billing, reports | Full visibility, revenue insights, team management |
| Front of House / Host | `Staff` | Check-in, walk-in, table assign, waitlist | Speed — must work under busy service pressure |
| Diner / Guest | `Guest` | Book, modify, cancel, check status | Simple flow, instant confirmation, WhatsApp reminder |
| Platform Admin | `Super Admin` | Tenant management, billing, health monitoring | Tenant onboarding tools, usage dashboards |

---

## 3. Booking Engine (Core)

The booking engine is the heart of the platform. It handles availability calculation, slot locking, conflict prevention, and confirmation generation. All booking operations funnel through this engine regardless of entry point (public widget, staff dashboard, or API).

### 3.1 Availability Calculation

When a guest requests available slots, the engine computes availability based on multiple constraints:

- **Operating hours** — slot must fall within configured open/close time for that day of week
- **Slot duration** — configurable per restaurant (e.g. 90-min dining window); no back-to-back bookings without buffer
- **Turn buffer time** — optional gap between reservations on the same table (default 15 min) for cleaning/reset
- **Party size matching** — only show tables where `capacity >= party_size`; support table combining for large groups
- **Blocked dates** — holidays, private events, or manual closures exclude slots entirely
- **Max advance booking** — configurable window (e.g. max 30 days ahead) to prevent scheduling too far out
- **Min advance booking** — configurable cutoff (e.g. must book at least 2 hours ahead)
- **Per-slot capacity limit** — max simultaneous guests per time slot across the entire restaurant (e.g. limit 40 covers per 30-min slot)

### 3.2 Slot Locking & Conflict Prevention

Prevents two guests from booking the same table at the same time — the most critical correctness requirement.

> **Implementation:** When a guest initiates checkout, issue a **distributed lock** (via Redis `SET NX EX`) on `lock:table:{id}:slot:{datetime}` for 5 minutes. On confirmed booking, write the reservation row with a **PostgreSQL unique constraint** on `(table_id, reserved_at)` as the final safety net. Release the lock on completion or expiry.

- **Optimistic UI** — slot appears available until lock is acquired; if lock fails, show "just taken" message with alternative slots
- **Lock expiry** — if guest abandons at payment/confirmation step, lock auto-releases after 5 min so slot becomes available again
- **Staff override** — staff can force-book a slot even if locked (e.g. override walk-in onto a table with a pending online reservation)

### 3.3 Table Combination Engine

For large parties that exceed single-table capacity, the engine can combine adjacent tables.

- Admin defines combinable table pairs/groups in floor plan settings
- Engine checks all tables in a group are free for the requested slot before offering combination
- Combined booking creates a single reservation linked to multiple table IDs via `reservation_tables` pivot
- Uncombine operation splits back to individual tables if one sub-reservation cancels

### 3.4 Booking Rules Engine

Per-restaurant configurable rules that run at booking time:

| Rule | Config | Behavior on Violation |
|---|---|---|
| Max party size | Integer (e.g. 20) | Block booking; suggest contacting restaurant directly |
| Deposit required above N pax | Integer threshold + amount | Route to payment step before confirmation |
| Require phone number | Boolean | Make phone field mandatory in guest form |
| Block same-guest double booking | Boolean | Detect by email/phone; warn or block |
| Blacklist guests | Email/phone list | Silently reject or show "unavailable" message |
| Special occasion upsell | Boolean | Show add-on options (cake, flowers) during booking |
| Auto-confirm vs manual confirm | Boolean per time slot | If manual, booking stays Pending until staff approves |

---

## 4. Table & Floor Management

### 4.1 Table Configuration

- Define tables with name/number, minimum and maximum capacity, section (indoor, outdoor, private room, bar), and shape (round, rectangle, booth)
- Set table status: `Active` / `Inactive` / `Under Maintenance`
- Priority order — when auto-assigning, prefer to fill smaller tables first to preserve large tables for groups
- Online bookable flag — some tables (e.g. bar seats) may be walk-in only, not shown on public booking page

### 4.2 Floor Plan Editor

Canvas-based drag-and-drop visual floor plan for staff situational awareness during service.

- Built in Next.js using `react-konva` or `fabric.js` — drag tables to position, set shape and size
- Positions stored as `position_x`, `position_y`, `width`, `height`, `rotation` in `tables` table
- Section backgrounds — upload floor plan image as background layer for accurate positioning
- Live service view — during service, each table tile shows: current reservation name, party size, time seated, and status color code
- Color legend: `Available` | `Reserved (upcoming)` | `Seated` | `Needs attention`

### 4.3 Operating Hours & Special Schedules

- Per-day-of-week open/close times with configurable slot intervals (15, 30, 45, 60 min)
- Multiple service periods per day — e.g. Lunch 11:00–14:30, Dinner 18:00–22:00 with a gap in between
- Blocked date ranges — public holidays, private events, renovation closures
- Special hours override — e.g. Christmas Eve extended hours or early closure
- Last seating time — auto-block slots where dining window extends past close (e.g. no 21:30 seating with 90-min window and 22:30 close)

---

## 5. Guest Booking Flow

The public-facing booking experience. Accessible via a shareable URL (`book.tablein.app/{slug}`), embeddable widget (iframe or JS snippet), or QR code. Optimized for mobile.

### 5.1 Step-by-Step Flow

**Step 1 — Select Date & Party Size**  
Calendar date picker showing only bookable dates. Party size selector (1–max_party). Shows restaurant name, logo, short description.

**Step 2 — Select Time Slot**  
Grid of available time slots for chosen date/party size. Unavailable slots shown as greyed out. If fully booked, show "Join Waitlist" option.

**Step 3 — Guest Details Form**  
Name (required), email (required), phone (optional/required per rules), special requests (free text), special occasion selector (birthday, anniversary, none), custom fields as configured by restaurant.

**Step 4 — Deposit Payment** *(conditional)*  
Only shown if restaurant rules require deposit. Integrated Midtrans/Xendit payment form. On payment failure, slot lock is retained for 5 min to allow retry.

**Step 5 — Confirmation**  
Booking summary with confirmation code. Options: Add to Google Calendar, share via WhatsApp, download PDF confirmation. Email sent immediately. WA message sent if phone provided.

### 5.2 Modify & Cancel (Self-Service)

- Guests receive a unique signed URL in their confirmation email: `/reservation/{confirmation_code}/manage`
- **Modify:** change date/time (subject to availability), adjust party size, update special requests — up to configurable cutoff (e.g. 2h before)
- **Cancel:** free cancellation up to cutoff; after cutoff, deposit forfeited (if applicable)
- Cancellation reason selector (changed plans, emergency, found elsewhere, other) — feeds into analytics
- On modification, re-run availability check and conflict prevention; release old slot lock, acquire new one

### 5.3 Booking Widget (Embed)

- JS snippet: `<script src="https://tablein.app/widget.js" data-slug="resto-slug"></script>` — renders a floating "Reserve a Table" button
- iFrame embed option for CMS-based restaurant sites (WordPress, etc.)
- Widget inherits restaurant's brand color for primary buttons (set in tenant settings)
- Widget communicates with the main booking API; no separate backend needed for embed
- CORS configured per tenant's registered domain

### 5.4 Walk-In Management (Staff)

- Staff can quickly add a walk-in: select date/time (defaults to now), party size, assign table, capture guest name/phone optionally
- Walk-in bypasses the public booking flow — no email confirmation required unless guest provides email
- Walk-in appears in the live dashboard alongside pre-booked reservations
- If no table is immediately available, staff can add walk-in to the waitlist with estimated wait time

---

## 6. Reservation State Machine

Every reservation moves through a defined set of states. State transitions trigger specific actions (notifications, report updates, deposit releases).

### State Flow

```
Pending → Confirmed → Seated → Completed
Pending → Cancelled
Confirmed → No-Show
Waitlisted → Confirmed
```

### State Definitions

| State | Who Can Set | Triggered Actions |
|---|---|---|
| `pending` | System (on booking creation) | Send confirmation email/WA to guest. Alert staff of new booking. |
| `confirmed` | System (auto) or Staff (manual review) | Send confirmed notification. Schedule 24h and 1h reminder jobs. |
| `seated` | Staff (check-in action) | Mark table as occupied on floor plan. Start session timer. Log visit in guest profile. |
| `completed` | Staff or System (auto after close) | Free table. Increment guest visit count. Trigger post-visit feedback request. Process deposit release if applicable. |
| `cancelled` | Guest (self-service), Staff, System | Free slot. Cancel pending reminder jobs. Notify next waitlist entry. Process deposit refund/forfeit per cancellation policy. |
| `no_show` | Staff or System (auto 30 min after slot) | Free table. Forfeit deposit. Increment guest no-show counter. Log in guest profile. Promote next waitlist entry. |
| `waitlisted` | System (on full availability) | Send waitlist confirmation with position. Monitor for cancellations to auto-promote. |

---

## 7. Waitlist System

Activated automatically when all slots for a requested date/time/party size are fully booked. Turns lost demand into future confirmed bookings.

### 7.1 Joining the Waitlist

- Guest completes the same form as a normal booking; system flags as `waitlisted` instead of `confirmed`
- Guest receives waitlist confirmation with their position number and estimated wait time (if configured)
- Guest can cancel their waitlist entry at any time via their management link
- Waitlist entries are ordered by `created_at ASC` (first in, first out per slot)

### 7.2 Auto-Promotion Logic

When a slot opens (cancellation, no-show, or staff-freed table), the system auto-promotes the first eligible waitlist entry:

1. **Trigger** — Reservation cancelled/no-showed → `ReservationCancelled` Laravel event fires
2. **Find next eligible** — Query waitlist for same date/time slot where `party_size ≤ freed table capacity`, ordered by position
3. **Notify guest** — Send WhatsApp + email: *"A table is available! Confirm within 30 minutes or your spot goes to the next guest."*
4. **Acceptance window** — Guest clicks confirm link. If not confirmed within 30 min (configurable), move to next waitlist entry and repeat
5. **Confirmed** — On acceptance, reservation transitions to `confirmed`. Assign table. Send full confirmation. Remove from waitlist.

### 7.3 Waitlist Management (Staff)

- View full waitlist per date/slot with position, name, party size, wait time, and contact
- Manually promote a waitlist entry to confirmed (bypass auto-promotion order)
- Remove entries, add notes, adjust position
- Physical walk-in waitlist — staff can add walk-in guests to a queue with estimated wait displayed on a customer-facing screen

---

## 8. Notifications & Reminders

All notifications are queued via Laravel Horizon (Redis-backed). Failures are retried with exponential backoff (3 attempts). All sends are logged in `notification_logs`.

### 8.1 Guest Notifications

| Event | Channel | Timing | Content |
|---|---|---|---|
| Booking created | Email + WA | Immediately | Confirmation code, date/time, party size, restaurant address, management link |
| Booking confirmed (manual) | Email + WA | Immediately | Confirmation from restaurant, same details as above |
| 24h reminder | Email + WA | 24h before | Reminder with booking details, cancel/modify link |
| 1h reminder | WA only | 1h before | Short: "Your table is ready for you at [time]. See you soon!" |
| Booking modified | Email + WA | Immediately | Updated details, new confirmation |
| Booking cancelled | Email | Immediately | Cancellation confirmation, refund info if deposit paid |
| Waitlist joined | Email | Immediately | Position number, estimated wait, cancel link |
| Waitlist promoted | WA + Email | Immediately | Slot available, 30-min confirmation window, accept link |
| Post-visit feedback | Email | 2h after completed | Short NPS survey link, thank you message |

### 8.2 Staff Notifications

- **New booking alert** — real-time push notification on dashboard (via Laravel Reverb WebSocket)
- **Cancellation alert** — immediate notification when guest cancels
- **Upcoming reservations digest** — daily email at 8AM with today's full reservation list
- **No-show alert** — 30 min after slot start if guest hasn't been marked seated
- **Low availability warning** — alert when restaurant reaches 80% capacity for any upcoming slot

### 8.3 Notification Configuration

- Per-restaurant toggle: enable/disable each notification type independently
- Custom message templates with variables: `{{guest_name}}`, `{{date}}`, `{{time}}`, `{{party_size}}`, `{{confirmation_code}}`, `{{restaurant_name}}`
- Sender identity: email from `noreply@{slug}.tablein.app` or custom domain; WA from restaurant's registered Fonnte/Wablas number
- Timezone-aware scheduling — all reminder jobs respect the tenant's configured timezone

---

## 9. Guest CRM

A lightweight guest relationship layer scoped per tenant. Guests are identified by email or phone number. No cross-tenant data sharing.

### 9.1 Guest Profile

- Auto-created on first booking using email or phone as identifier
- Merged if same guest books with same email again — visit count incremented, history appended
- **Fields:** name, email, phone, preferred language, tags (VIP, allergies, regular), internal notes (staff only), birthday month
- **Computed fields:** total visits, total covers, average party size, first visit date, last visit date, no-show count, cancellation count

### 9.2 Visit History

- Full reservation history per guest: date, table, party size, special requests, status, staff notes
- Filter by status (completed, no-show, cancelled) and date range
- Staff can add post-visit notes to a reservation (e.g. *"celebrated anniversary, likes corner tables"*)

### 9.3 Guest Tags & Segmentation

- **Manual tags:** VIP, Regular, Food Allergy, Blacklisted, Birthday Month, Corporate
- **Auto-tags:** system assigns based on rules — e.g. "Regular" after 5 completed visits, "At Risk" after 90 days no visit
- Tag-based filtering in guest list — staff can search/filter by tag for targeted attention
- Blacklisted guests: booking attempt shows as unavailable on public page; no reason shown to guest

### 9.4 Feedback & NPS

- Post-visit email sent 2 hours after reservation marked `completed`
- **Feedback form:** NPS score (0–10), overall rating (1–5), food/service/ambience sub-ratings, free text comment
- Responses linked to reservation and guest profile
- Negative responses (NPS < 7) trigger staff alert for follow-up
- Aggregate NPS and ratings shown on owner analytics dashboard

---

## 10. Deposits & Payments

### 10.1 Deposit Types

| Type | Config | Use Case |
|---|---|---|
| Fixed amount per booking | IDR amount | e.g. IDR 100,000 deposit for any reservation |
| Per person amount | IDR × party size | e.g. IDR 50,000/pax for large groups |
| Conditional (above N pax) | Integer threshold + amount type | Free for ≤4, deposit required for 5+ |
| Full prepayment | Fixed menu price | Tasting menus, set menus, private dining |
| No deposit | Default | Standard bookings, free cancellation |

### 10.2 Payment Flow

1. **Booking triggers payment requirement** — Booking rules engine evaluates if deposit is required. If yes, guest is routed to payment step after filling details.
2. **Payment gateway redirect** — Laravel creates a payment order via Midtrans/Xendit API. Guest redirected to hosted payment page. Table slot lock extended to 15 min during payment.
3. **Webhook confirmation** — Gateway POSTs to `/api/v1/webhooks/payment`. Laravel verifies signature, updates `payments` table, transitions reservation to `confirmed`.
4. **Refund handling** — On cancellation: if within free cancellation window → auto-refund via gateway API. If outside window → marked as forfeited. Owner can manual-override to issue refund.

### 10.3 Payment Methods (via Midtrans / Xendit)

| Method | Options | Notes |
|---|---|---|
| Bank Transfer | BCA, Mandiri, BNI, BRI | Virtual account — 24h expiry |
| E-Wallet | GoPay, OVO, DANA, ShopeePay | Instant confirmation |
| Card | Visa, Mastercard | 3DS authenticated |
| QRIS | Universal QR | Scan any e-wallet |

---

## 11. Staff & Owner Dashboard

### 11.1 Live Service View (Staff)

The primary screen during service hours. Designed for speed — every action reachable in ≤2 taps.

- **Today's timeline** — horizontal time axis showing all reservations by slot, color-coded by status
- **Floor plan view** — visual table map with live status overlays; click any table to see current/next reservation
- **Quick check-in** — search by name, confirmation code, or phone → one click to mark `seated`
- **Quick actions per reservation** — Seat, Complete, No-Show, Add Note, Move Table
- **Walk-in button** — prominent CTA to add a walk-in instantly
- **Upcoming alert strip** — shows reservations starting in the next 30 minutes
- **Real-time updates** — new bookings and changes appear instantly via WebSocket without page refresh

### 11.2 Reservation Management (Calendar)

- Calendar view (day / week / month) with reservation density heatmap overlay
- Day view: sortable list of all reservations with filters by status, section, party size
- Click any reservation to open detail panel: full guest info, history, notes, payment status, action buttons
- Staff can create/edit/cancel reservations directly from calendar
- Drag-to-reschedule within day view (validates against availability rules)

### 11.3 Owner Dashboard

- **Today at a glance** — total covers booked, check-ins so far, cancellations today, current occupancy %
- **KPI cards** — this week vs last week: bookings, covers, no-show rate, cancellation rate
- **Revenue summary** — total deposits collected this month, pending refunds
- **NPS score** — rolling 30-day average with trend indicator
- **Upcoming busy slots** — next 7 days with occupancy % per slot — helps with staffing decisions
- **Recent guests** — last 10 unique guests with visit count and last visit date
- **Team activity feed** — log of staff actions (who checked in, who added walk-in, etc.)

---

## 12. Reports & Analytics

| Report | Dimensions | Metrics | Export |
|---|---|---|---|
| Occupancy Report | Date range, section, day of week | Covers booked, capacity utilization %, peak slots, average party size | CSV, PDF |
| Reservation Summary | Date range, status, source | Total bookings, completed, cancelled, no-show, waitlist conversion | CSV |
| Guest Analytics | Date range, tags | New vs returning guests, top guests by visits, no-show risk segments | CSV |
| Cancellation Analysis | Date range, cancellation reason | Cancellation rate, avg lead time, revenue impact | CSV |
| Revenue Report | Date range | Deposits collected, refunded, forfeited, net deposit revenue | CSV, PDF |
| NPS & Feedback | Date range | NPS score, promoters/passives/detractors %, sub-rating averages, free text responses | CSV |
| Notification Delivery | Date range, channel | Sent, delivered, failed rates per notification type | CSV |

> All reports are generated as async jobs (Laravel queue) to avoid blocking the request. Owner receives an email with download link when the report is ready for large date ranges.

---

## 13. Multi-Tenancy & Settings

### 13.1 Tenant Isolation

- Shared PostgreSQL database; all tenant data tables have `tenant_id UUID FK`
- Laravel `GlobalScope` applied to all Eloquent models — queries automatically filtered by authenticated tenant
- Enforced at API middleware layer: resolve tenant from token, inject into app context
- Test suite includes cross-tenant assertion tests to catch any data leakage
- Storage isolated by prefix: R2 bucket path `{tenant_id}/{type}/{filename}`

### 13.2 Restaurant Settings

| Category | Settings |
|---|---|
| Profile | Name, description, address, cuisine type, phone, website, logo, cover photo |
| Booking Rules | Auto-confirm toggle, min/max advance booking, max party size, slot duration, turn buffer, cancellation cutoff |
| Notifications | Per-type enable/disable, WA number, email from, custom templates, reminder timing |
| Payment | Gateway provider (Midtrans/Xendit), API keys, deposit rules per party size |
| Branding | Primary brand color for widget, booking page header image, custom footer text |
| Integrations | Widget embed code, Google Calendar sync toggle, webhook URL for POS |
| Team | Invite staff by email, assign roles (Owner/Staff), revoke access |

### 13.3 Onboarding Flow (New Tenant)

1. **Register** — Owner registers with email + restaurant name. Slug auto-generated from name (editable once).
2. **Setup Wizard (5 steps)** — Operating hours → Add tables → Booking rules → Notification preferences → Connect WA/Email sender. Each step is optional to skip; defaults are sensible.
3. **Preview & Publish** — Preview public booking page before going live. One-click publish makes booking page accessible at `book.tablein.app/{slug}`.
4. **Share** — Dashboard provides shareable link, QR code download, and embed snippet ready to copy.

---

## 14. Database Schema

PostgreSQL 16. UUID primary keys throughout. `tenant_id` FK on all data tables. Soft deletes on reservations and guests.

### tenants
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | string | |
| slug | string unique | |
| plan | enum | free\|pro\|business |
| timezone | string | |
| is_published | boolean | |
| settings | jsonb | |
| trial_ends_at | timestamp | |
| created_at | timestamp | |

### users
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| name | string | |
| email | string | |
| password | string | hashed |
| role | enum | owner\|staff |
| last_active_at | timestamp | |

### tables
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| name | string | |
| min_capacity | integer | |
| max_capacity | integer | |
| section | string | indoor\|outdoor\|private\|bar |
| shape | enum | round\|rectangle\|booth |
| status | enum | active\|inactive\|maintenance |
| online_bookable | boolean | |
| priority | integer | |
| pos_x / pos_y | float | floor plan position |
| width / height | float | floor plan size |
| rotation | float | |

### table_combinations
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| name | string | |
| max_capacity | integer | |

### combination_tables *(pivot)*
| Column | Type |
|---|---|
| combination_id | uuid FK |
| table_id | uuid FK |

### operating_hours
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| day_of_week | integer | 0–6 (Sun–Sat) |
| period_name | string | e.g. Lunch, Dinner |
| open_time | time | |
| close_time | time | |
| slot_duration | integer | minutes |
| turn_buffer | integer | minutes |
| max_covers | integer | |
| is_closed | boolean | |

### blocked_dates
| Column | Type |
|---|---|
| id | uuid PK |
| tenant_id | uuid FK |
| start_date | date |
| end_date | date |
| reason | string |

### guests
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| name | string | |
| email | string | |
| phone | string | |
| tags | json array | |
| notes | text | staff only |
| birthday_month | integer | |
| is_blacklisted | boolean | |
| visit_count | integer | computed |
| no_show_count | integer | computed |
| last_visit_at | timestamp | |
| deleted_at | timestamp | soft delete |

### reservations
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| guest_id | uuid FK | |
| table_id | uuid FK nullable | nullable if using combination |
| status | enum | pending\|confirmed\|seated\|completed\|cancelled\|no_show\|waitlisted |
| source | enum | online\|walkin\|staff |
| party_size | integer | |
| reserved_at | timestamp | UTC |
| duration_mins | integer | |
| confirmation_code | string unique | |
| special_requests | text | |
| occasion | string nullable | birthday\|anniversary\|etc |
| custom_fields | jsonb | |
| staff_notes | text | |
| seated_at | timestamp | |
| completed_at | timestamp | |
| cancelled_at | timestamp | |
| cancel_reason | string | |
| created_by | uuid FK users | |
| deleted_at | timestamp | soft delete |

> **Critical constraint:** Add a **partial unique index** on `reservations(table_id, reserved_at)` where `status NOT IN ('cancelled')` — this is the DB-level backstop against double booking that works even if the Redis lock fails.

### reservation_tables *(pivot)*
| Column | Type | Notes |
|---|---|---|
| reservation_id | uuid FK | |
| table_id | uuid FK | |
| UNIQUE | | (reservation_id, table_id) |

### waitlist_entries
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| guest_id | uuid FK | |
| requested_at | timestamp | |
| party_size | integer | |
| position | integer | |
| status | enum | waiting\|notified\|expired\|converted\|cancelled |
| notified_at | timestamp | |
| expires_at | timestamp | 30-min window |
| converted_reservation_id | uuid FK | |

### payments
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| reservation_id | uuid FK | |
| gateway | enum | midtrans\|xendit |
| gateway_order_id | string | |
| amount | bigint | IDR (cents-free) |
| currency | string | |
| status | enum | pending\|paid\|refunded\|forfeited |
| payment_method | string | va_bca\|gopay\|qris\|etc |
| paid_at | timestamp | |
| refunded_at | timestamp | |
| metadata | jsonb | gateway raw response |

### feedback
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| reservation_id | uuid FK | |
| guest_id | uuid FK | |
| nps_score | integer | 0–10 |
| rating_overall | integer | 1–5 |
| rating_food | integer | 1–5 |
| rating_service | integer | 1–5 |
| rating_ambience | integer | 1–5 |
| comment | text | |
| submitted_at | timestamp | |

### notification_logs
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| reservation_id | uuid FK | |
| type | enum | booking_created\|reminder_24h\|reminder_1h\|etc |
| channel | enum | email\|whatsapp |
| recipient | string | email or phone |
| status | enum | sent\|failed\|delivered |
| attempt_count | integer | |
| sent_at | timestamp | |
| error_message | text nullable | |

### booking_rules
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| rule_type | string | |
| config | jsonb | rule parameters |
| is_active | boolean | |

---

## 15. API Reference

RESTful API under `/api/v1/`. Auth via `Authorization: Bearer {token}` (Laravel Sanctum). Tenant context resolved from token. Rate limited per tenant per plan.

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Obtain Sanctum token |
| POST | `/auth/logout` | Revoke current token |
| POST | `/auth/register` | New tenant owner registration |
| POST | `/auth/forgot-password` | Send reset link |
| POST | `/auth/reset-password` | Reset with token |

### Public Booking *(No Auth — Rate Limited)*

| Method | Endpoint | Description |
|---|---|---|
| GET | `/public/{slug}` | Get restaurant public profile |
| GET | `/public/{slug}/availability` | Get available slots for date + party_size |
| POST | `/public/{slug}/reservations` | Create new reservation (acquires lock) |
| GET | `/public/reservations/{code}` | Get reservation by confirmation code |
| PUT | `/public/reservations/{code}` | Guest self-service modify |
| DELETE | `/public/reservations/{code}` | Guest self-service cancel |
| POST | `/public/{slug}/waitlist` | Join waitlist for a slot |
| POST | `/public/waitlist/{id}/confirm` | Accept waitlist promotion (30-min window) |
| POST | `/public/feedback/{code}` | Submit post-visit feedback |

### Reservations *(Staff+)*

| Method | Endpoint | Description |
|---|---|---|
| GET | `/reservations` | List with filters: date, status, table, source |
| POST | `/reservations` | Staff create reservation (walk-in or manual) |
| GET | `/reservations/{id}` | Get single reservation detail |
| PUT | `/reservations/{id}` | Update reservation (reschedule, resize party) |
| PATCH | `/reservations/{id}/status` | Transition status (seat, complete, no-show, cancel) |
| PATCH | `/reservations/{id}/table` | Reassign to different table |
| POST | `/reservations/{id}/notes` | Add staff note to reservation |

### Tables *(Owner)*

| Method | Endpoint | Description |
|---|---|---|
| GET | `/tables` | List all tables |
| POST | `/tables` | Create table |
| PUT | `/tables/{id}` | Update table config / floor position |
| DELETE | `/tables/{id}` | Deactivate table (soft) |
| GET | `/tables/{id}/availability` | Get table-specific availability timeline |
| POST | `/tables/combinations` | Define a combinable table group |

### Guests *(Staff+)*

| Method | Endpoint | Description |
|---|---|---|
| GET | `/guests` | Search and list guests with filters/tags |
| GET | `/guests/{id}` | Guest profile with computed stats |
| GET | `/guests/{id}/history` | Full reservation history |
| PUT | `/guests/{id}` | Update profile, tags, notes |
| PATCH | `/guests/{id}/blacklist` | Toggle blacklist status |

### Waitlist *(Staff+)*

| Method | Endpoint | Description |
|---|---|---|
| GET | `/waitlist` | List waitlist entries for a date/slot |
| PATCH | `/waitlist/{id}/promote` | Manually promote entry to confirmed |
| DELETE | `/waitlist/{id}` | Remove from waitlist |

### Reports *(Owner)*

| Method | Endpoint | Description |
|---|---|---|
| GET | `/reports/occupancy` | Occupancy % by date/section/slot |
| GET | `/reports/reservations` | Reservation summary by status/source |
| GET | `/reports/guests` | Guest analytics (new vs returning, segments) |
| GET | `/reports/revenue` | Deposit revenue summary |
| GET | `/reports/nps` | NPS and feedback aggregates |
| POST | `/reports/export` | Queue async export; returns job ID |
| GET | `/reports/export/{job}` | Get export status / download URL |

### Settings *(Owner)*

| Method | Endpoint | Description |
|---|---|---|
| GET | `/settings` | Get all tenant settings |
| PUT | `/settings/profile` | Update restaurant profile |
| PUT | `/settings/hours` | Update operating hours and slots |
| PUT | `/settings/booking-rules` | Update booking engine rules |
| PUT | `/settings/notifications` | Update notification config and templates |
| PUT | `/settings/payments` | Configure gateway and deposit rules |
| GET | `/settings/team` | List team members |
| POST | `/settings/team/invite` | Invite staff by email |
| DELETE | `/settings/team/{id}` | Revoke team access |

### Webhooks & Real-time

| Method | Endpoint | Description |
|---|---|---|
| POST | `/webhooks/payment` | Midtrans/Xendit payment callback (signature verified) |
| GET | `/dashboard/live` | WebSocket channel via Laravel Reverb |

---

## 16. Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, React Query (TanStack), Zustand, React Konva (floor plan), Recharts (analytics) |
| **Backend** | Laravel 13, PHP 8.3, Laravel Sanctum, Laravel Horizon, Laravel Reverb, Laravel Telescope (dev), stancl/tenancy |
| **Database** | PostgreSQL 16, Redis 7 |
| **Storage** | Cloudflare R2, Cloudflare CDN |
| **Infra** | DigitalOcean VPS (4GB), Vercel (Next.js), DO Managed PostgreSQL, Ploi.io (provisioning), Sentry (errors) |
| **Integrations** | Midtrans / Xendit (payments), Fonnte / Wablas (WhatsApp), Resend (email), Laravel Reverb (WebSocket) |

---

## 17. Roadmap

### Phase 1 — MVP (Weeks 1–8)
- Project scaffold & CI/CD
- Auth + multi-tenancy
- Table management
- Booking engine core
- Slot locking (Redis)
- Public booking page
- Email confirmations
- Reservation CRUD
- Staff live dashboard
- State machine
- Walk-in management

### Phase 2 — Growth (Weeks 9–16)
- Waitlist system
- WhatsApp reminders
- Guest CRM profiles
- Guest self-service modify/cancel
- Deposit payments
- Floor plan editor
- Booking rules engine
- Custom form fields
- Analytics dashboard
- Report exports
- Embed widget
- Notification templates

### Phase 3 — Scale (Weeks 17–24)
- Post-visit NPS feedback
- Guest tags & segments
- Table combination engine
- Multi-service periods
- Blocked dates & special hours
- Team activity logs
- Webhook / POS integration
- Billing & plan enforcement

### Phase 4 — Expansion (Week 25+)
- Multi-location (chains)
- Loyalty program
- Marketplace listing
- React Native mobile app
- TV/display mode (walk-in queue)
- Advanced guest marketing

---

## 18. Pricing Tiers

Monthly billing in IDR. Annual plan 20% discount. 14-day free trial on Pro (no credit card required).

### Starter — Free / forever
- Up to 50 reservations/month
- 1 staff account
- Basic booking page
- Email confirmations only
- 7-day history
- Basic dashboard

### Pro — IDR 999,000 / month *(recommended)*
- Unlimited reservations
- Up to 5 staff accounts
- WhatsApp reminders
- Waitlist system
- Guest CRM profiles
- Custom booking fields
- Analytics & exports
- Deposit payments
- Booking rules engine
- Embed widget
- Floor plan editor

### Business — IDR 1,999,000 / month
- Everything in Pro
- Unlimited staff accounts
- Multi-location support
- API & webhook access
- Custom domain for booking page
- Priority support
- NPS & feedback module
- Guest segmentation & tags
- Team activity logs
- SLA 99.5% uptime guarantee

---

## 19. Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| Performance | API response time (p95) | < 200ms reads; < 500ms booking create |
| Availability | Uptime SLA | 99.5% monthly (Business); 99% others |
| Concurrency | Booking conflict prevention | Redis lock + PostgreSQL partial unique index — both layers required |
| Security | Tenant data isolation | Laravel GlobalScope on all models; cross-tenant test suite in CI |
| Security | Payment webhooks | Signature verification on all incoming gateway webhooks |
| Security | Guest management links | Signed URLs with 7-day expiry using Laravel URL signing |
| Scalability | Horizontal scaling path | Stateless Laravel API; Redis sessions; queue-based async ops |
| Observability | Error tracking | Sentry in production; Laravel Telescope in dev/staging |
| Observability | Queue monitoring | Laravel Horizon dashboard; alert on queue depth > 100 |
| Backup | Database | Daily automated backup via DO Managed Postgres; 7-day retention |
| Timezone | All scheduling | All times stored in UTC; converted to tenant timezone at display layer |
| Accessibility | Public booking page | WCAG 2.1 AA — keyboard navigable, screen reader compatible |

---

## 20. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Double booking race condition | 🔴 Critical | Redis lock (first layer) + PostgreSQL partial unique index (second layer). Both must be in place before launch. |
| Tenant data leakage | 🔴 Critical | Laravel GlobalScope on all models + cross-tenant assertion tests in CI pipeline — must pass before every deploy. |
| WhatsApp API ban / rate limit | 🟠 High | Fallback to email if WA fails. Use registered business number. Queue with minimum 3s delay between messages per tenant. |
| Payment gateway downtime | 🟠 High | Deposits are optional by default; restaurant can fall back to manual confirmation flow. Support 2 gateway options (Midtrans + Xendit). |
| Redis failure (lock service down) | 🟠 High | DB unique constraint remains as final backstop. Circuit breaker: if Redis unavailable, fall back to DB-only lock (slower but safe). |
| Waitlist promotion loop | 🟡 Medium | Cap promotion attempts per slot at 5. After exhaustion, staff is notified to handle manually. Log all promotion attempts. |
| Timezone misconfiguration | 🟡 Medium | Enforce UTC storage everywhere. Require timezone selection during onboarding. Display all times in tenant-local timezone with UTC offset shown. |
| Slow adoption / no paying customers | 🟡 Medium | Freemium entry with no credit card. WhatsApp-native UX. Embed widget for existing restaurant websites. Personal outreach to Bali restaurants. |

---

## Next Steps

1. Finalize brand name & domain for the SaaS
2. Set up monorepo: `/api` (Laravel) + `/web` (Next.js) + `/docs`
3. Provision DO VPS + DO Managed Postgres + Redis on same droplet
4. Scaffold Laravel with `stancl/tenancy`, Sanctum, Horizon, Reverb
5. Write base migrations (tenants, users, tables, operating_hours, reservations)
6. Build vertical slice #1: availability endpoint + create reservation + email confirmation

---

*Restaurant Booking Engine · Full PRD v2.0 · Laravel + Next.js · April 2026*
