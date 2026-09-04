/**
 * Domain types — kept in sync with tamu-backend Eloquent resources.
 * Phase 1 surface: auth, tables, availability, reservations.
 */

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show"
  | "waitlisted";

export type ReservationSource = "online" | "walkin" | "staff";

export type TableSection = "indoor" | "outdoor" | "private" | "bar" | string;
export type TableShape = "round" | "rectangle" | "booth";
export type TableStatus = "active" | "inactive" | "maintenance";

export interface CategoryTerminology {
  reservation?: string;
  reservations?: string;
  resource?: string;
  resources?: string;
  party?: string;
  book_cta?: string;
  book_intro?: string;
}

export interface CategoryConfig {
  label?: string;
  booking_strategy?: string;
  resource?: string;
  secondary_resource?: string | null;
  catalog?: string | null;
  uses_party_size?: boolean;
  sections?: string[];
  terminology?: CategoryTerminology;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  /** Server-computed paid capabilities (plan features + per-venue add-ons). */
  features?: string[];
  /** Business vertical: restaurant | cafe | spa | wellness | … */
  category?: string;
  category_config?: CategoryConfig;
  timezone: string;
  is_published?: boolean;
}

export interface User {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: string;
  last_active_at?: string | null;
  created_at?: string;
}

/** A venue this account can act on, with the role it holds there. */
export interface TenantMembershipSummary {
  id: string;
  name: string;
  slug: string;
  role: string | null;
}

export interface AuthResponse {
  user: User;
  tenant: Tenant | null;
  token: string;
  /** Every venue this account can switch to. Absent on older backends. */
  tenants?: TenantMembershipSummary[];
}

export interface Table {
  id: string;
  tenant_id: string;
  name: string;
  min_capacity: number;
  max_capacity: number;
  section: string;
  shape: TableShape;
  status: TableStatus;
  online_bookable: boolean;
  priority: number;
  /** TRUE cents (IDR × 100). Null inherits the section default. */
  price_cents?: number | null;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
  /** Placement on the section's venue map, in SVG viewBox units.
   *  Null = not yet placed. Distinct from `position`, which is the staff
   *  floor-plan grid and uses a different coordinate space entirely. */
  map_position?: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  } | null;
  created_at?: string;
  updated_at?: string;
}

/* ===== Spa catalog types ===== */

export interface SpaService {
  id: string;
  name: string;
  description?: string | null;
  duration_mins: number;
  price_cents: number;
  currency: string;
  is_active: boolean;
  display_order: number;
  therapist_ids?: string[];
  therapists?: { id: string; name: string }[];
}

export interface Therapist {
  id: string;
  name: string;
  bio?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  display_order: number;
  service_ids?: string[];
  services?: { id: string; name: string }[];
}

export interface SpaRoom {
  id: string;
  name: string;
  is_active: boolean;
  display_order: number;
}

export interface SpaAppointmentService {
  id: string;
  name: string;
  duration_mins: number;
  price_cents: number;
  currency: string;
}

export interface SpaAppointmentTherapist {
  id: string;
  name: string;
}

export interface SpaAppointmentRoom {
  id: string;
  name: string;
}

export interface AvailabilitySlot {
  time: string;
  available: boolean;
  capacity?: number;
  table_ids?: string[];
}

export interface AvailabilityResponse {
  date: string;
  party_size?: number;
  service_id?: string;
  therapist_id?: string | null;
  slots: AvailabilitySlot[];
}

export interface Guest {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  /** Lifetime count of created reservations (any status). Surfaced as
   *  "returning customer" affordances at booking time. */
  total_bookings?: number;
}

export interface Reservation {
  id: string;
  tenant_id: string;
  confirmation_code: string;
  status: ReservationStatus;
  source: ReservationSource;
  party_size: number;
  reserved_at: string; // ISO 8601
  duration_mins: number;
  special_requests?: string | null;
  occasion?: string | null;
  custom_fields?: Record<string, unknown> | null;
  staff_notes?: string | null;
  table_id?: string | null;
  combination_id?: string | null;
  /** Present when eager-loaded alongside single-table bookings. */
  table?: Table | null;
  tables?: Table[];
  /** Spa/wellness appointment fields (null for restaurant reservations). */
  service_id?: string | null;
  therapist_id?: string | null;
  room_id?: string | null;
  service?: SpaAppointmentService | null;
  therapist?: SpaAppointmentTherapist | null;
  room?: SpaAppointmentRoom | null;
  guest?: Guest;
  /** Deposit due (true cents) + the hosted-invoice payment, when required. */
  deposit_cents?: number | null;
  /** TRUE cents (IDR × 100) — pre-ordered menu items, billed with the deposit. */
  menu_total_cents?: number | null;
  menu_order_items?: ReservationMenuLine[];
  payment?: ReservationPayment | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  created_at?: string;
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  /** Echoed by GET /reservations so venue-local display works before session tenant hydrates */
  tenant_timezone?: string;
}

export interface WalkInLedgerSummary {
  date: string;
  timezone: string;
  total: number;
  by_status: Record<string, number>;
}

export interface ListEnvelope<T> {
  data: T[];
  meta?: PaginationMeta & { walk_in_summary?: WalkInLedgerSummary } & Record<string, unknown>;
}

export interface ItemEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

/* ===== Mutation payload types ===== */

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  restaurant_name: string;
  timezone?: string;
  category?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  device_name?: string;
}

export interface CreateTablePayload {
  name: string;
  min_capacity: number;
  max_capacity: number;
  section?: string;
  shape?: TableShape;
  status?: TableStatus;
  online_bookable?: boolean;
  priority?: number;
  /** TRUE cents (IDR × 100). */
  price_cents?: number | null;
  pos_x?: number;
  pos_y?: number;
  width?: number;
  height?: number;
  rotation?: number;
}

export type UpdateTablePayload = Partial<CreateTablePayload>;

export interface ReservationGuestPayload {
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface CreateReservationPayload {
  reserved_at: string; // ISO datetime
  party_size?: number;
  duration_mins?: number;
  guest: ReservationGuestPayload;
  special_requests?: string;
  occasion?: string;
  staff_notes?: string;
  source?: ReservationSource;
  table_id?: string;
  combination_id?: string;
  service_id?: string;
  therapist_id?: string;
}

export interface RescheduleReservationPayload {
  reserved_at?: string;
  party_size?: number;
  duration_mins?: number;
  table_id?: string;
}

/* ===== Public booking types ===== */

export interface CustomBookingField {
  key: string;
  label: string;
  type: "text" | "select";
  required?: boolean;
  options?: string[];
}

export interface PublicTenantWaitlistProfile {
  enabled: boolean;
}

export interface PublicTenant {
  name: string;
  slug: string;
  timezone: string;
  is_published: boolean;
  category?: string;
  booking_strategy?: string;
  terminology?: CategoryTerminology;
  uses_party_size?: boolean;
  waitlist: PublicTenantWaitlistProfile;
  /** Derived capability — true when guests may pick their table from a map. */
  venue_map?: { enabled: boolean };
  /** Whether the booking page should include a Menu step, and if it can order. */
  menu?: { visible: boolean; ordering_enabled: boolean };
  custom_booking_fields: CustomBookingField[];
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  cuisine?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  brand_color?: string | null;
}

export interface PublicSpaCatalog {
  services: SpaService[];
  therapists: Therapist[];
}

export interface PublicAvailabilitySlot {
  time: string; // HH:MM (tenant local)
  reserved_at_utc: string; // ISO UTC
  period: string;
  available: boolean;
}

export interface PublicAvailabilityResponse {
  date: string;
  party_size?: number;
  service_id?: string;
  therapist_id?: string | null;
  slots: PublicAvailabilitySlot[];
}

/** Deposit payment attached to a reservation (Xendit hosted invoice). */
export interface ReservationPayment {
  status: PaymentStatus;
  amount_cents: number;
  currency: string;
  invoice_url?: string | null;
  paid_at?: string | null;
  /** Xendit's invoice expiry — drives the countdown on /pay/[code]. */
  expires_at?: string | null;
}

export interface PublicReservation {
  confirmation_code: string;
  status: ReservationStatus;
  party_size: number;
  reserved_at: string;
  duration_mins: number;
  special_requests?: string | null;
  occasion?: string | null;
  guest?: {
    name: string | null;
    email: string | null;
    phone: string | null;
    /** Lifetime count of created reservations for this email/phone, including the current one. */
    total_bookings?: number;
  };
  cancelled_at?: string | null;
  /** Assigned table(s): name + section for the guest (no internal ids). */
  assigned_tables?: { name: string; section?: string | null }[];
  /** Spa/wellness appointment details. */
  service?: SpaAppointmentService | null;
  therapist?: SpaAppointmentTherapist | null;
  room?: SpaAppointmentRoom | null;
  /** Deposit due (true cents) + the hosted-invoice payment, when required. */
  deposit_cents?: number | null;
  payment?: ReservationPayment | null;
  /** Pre-ordered menu, snapshotted at booking time. */
  menu_total_cents?: number | null;
  menu_order_items?: ReservationMenuLine[];
  /** Venue identity for the guest-facing payment page. */
  venue?: PublicReservationVenue | null;
  /** Venue IANA timezone for displaying reserved_at */
  restaurant_timezone?: string;
}

export interface PublicReservationVenue {
  name: string;
  logo_url?: string | null;
  /** Already validated server-side as a hex colour, or null. Guard again anyway. */
  brand_color?: string | null;
}

export interface PublicCreateReservationPayload {
  reserved_at: string;
  /** Guest-chosen table — honoured only for venues with the venue_map feature. */
  table_id?: string;
  /**
   * Pre-ordered menu lines — honoured only for venues with the menu_ordering
   * feature AND a connected gateway. Ids and quantities only: the server prices
   * the order from its own catalogue and ignores anything else sent here.
   */
  menu_items?: MenuOrderLine[];
  party_size?: number;
  duration_mins?: number;
  service_id?: string;
  therapist_id?: string;
  guest: {
    name: string;
    email: string;
    phone?: string | null;
    marketing_opt_in?: boolean;
    birthday_month?: number | null;
    birthday_day?: number | null;
  };
  special_requests?: string;
  occasion?: string;
  custom_fields?: Record<string, unknown>;
}

export interface JoinWaitlistPayload {
  reserved_at: string;
  party_size: number;
  duration_mins?: number;
  notes?: string;
  guest: { name: string; email?: string | null; phone?: string | null };
}

export interface WaitlistEntryPublic {
  id: string;
  status: string;
  reserved_at: string;
  party_size: number;
  duration_mins: number;
  position: number;
  notes?: string | null;
  guest?: GuestProfile;
  reservation_id?: string | null;
  created_at: string;
}

export interface GuestProfile extends Guest {
  tags?: string[] | null;
  notes?: string | null;
  birthday_month?: number | null;
  birthday_day?: number | null;
  is_blacklisted?: boolean;
  whatsapp_consent?: boolean | null;
  email_consent?: boolean | null;
  marketing_consent_source?: string | null;
  marketing_consent_at?: string | null;
  visit_count?: number;
  no_show_count?: number;
  /** total_bookings is also inherited via Guest, redeclared for clarity. */
  total_bookings?: number;
  last_visit_at?: string | null;
  created_at?: string;
}

export interface OperatingHourRow {
  id: string;
  day_of_week: number;
  period_name: string;
  open_time: string | null;
  close_time: string | null;
  slot_duration: number;
  turn_buffer: number;
  max_covers: number | null;
  is_closed: boolean;
}

export interface BookingRuleRow {
  id: string;
  rule_type: string;
  config: Record<string, unknown> | null;
  is_active: boolean;
}

export interface RestaurantSnapshot {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  is_published: boolean;
}

export interface TenantPublicProfileDraft {
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  cuisine?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
}

/**
 * Subset of tenant.settings the notifications tab cares about. The backend
 * stores arbitrary JSON, so anything not listed here may still exist on
 * the wire — treat reads defensively.
 */
export interface TenantNotificationSettings {
  /** Lead time before slot to fire the guest reminder. Multiple of 5, 5–60. */
  reminder_minutes_before?: number | null;
  email_confirmation?: boolean;
  /** Legacy array (hours-before); not consumed by the notifier today. */
  reminder_hours_before?: number[];
}

export interface TenantSettingsSnapshot {
  restaurant: RestaurantSnapshot;
  settings: Record<string, unknown> | null;
  booking_rules: BookingRuleRow[];
  /** Weekly service windows + slot grid inputs; omit on older backends. */
  operating_hours?: OperatingHourRow[];
  /** WasenderAPI inbox connection (API key redacted; webhook URL when configured). */
  whatsapp_inbox?: WhatsappInboxStatus;
}

export interface WhatsappInboxStatus {
  configured: boolean;
  session_connected?: boolean | null;
  webhook_url: string | null;
  api_key_hint: string | null;
  provider?: "meta" | "wasenderapi";
  driver?: string;
}

export interface WhatsappConversation {
  id: string;
  phone_e164: string;
  contact_name?: string | null;
  contact_avatar_url?: string | null;
  guest_id?: string | null;
  guest?: GuestProfile | null;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  unread_count: number;
}

export interface WhatsappMessage {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  body: string;
  status?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
}

export interface WhatsappConversationDetail {
  conversation: WhatsappConversation;
  messages: WhatsappMessage[];
}

export interface PatchSettingsResponse {
  settings: Record<string, unknown> | null;
  restaurant: RestaurantSnapshot;
  whatsapp_inbox?: WhatsappInboxStatus;
}

export interface ReportSummary {
  from: string;
  to: string;
  timezone: string;
  counts: {
    total: number;
    covers_completed: number;
    waitlisted_created: number;
    no_show: number;
    cancelled: number;
    repeat_guest_rate_percent: number;
  };
  by_status: Record<string, number>;
  /** Densified daily series in tenant TZ — every day in [from, to] is present
   *  even when zero, so chart axes don't gap. Each row tracks per-status counts
   *  alongside total + covers (sum of party_size for the bucket). */
  by_day: ReportDailyRow[];
  /** Party-size histogram, ascending by party_size. */
  by_party_size: { party_size: number; count: number }[];
  /** Treatments booked, most-booked first. Spa/wellness only — empty for
   *  verticals with no service catalog. */
  by_service?: { service_id: string; name: string; count: number }[];
}

export interface ReportDailyRow {
  date: string;
  total: number;
  covers: number;
  pending: number;
  confirmed: number;
  seated: number;
  completed: number;
  cancelled: number;
  no_show: number;
  waitlisted: number;
}

/* ===== Event ticketing ===== */

export type EventStatus = "draft" | "published" | "cancelled" | "completed";
export type TicketStatus = "issued" | "checked_in" | "void" | "refunded";
export type TicketOrderStatus = "pending" | "paid" | "cancelled" | "refunded";

/**
 * Free-form customizable event page config. The page builder renders an
 * ordered list of typed blocks plus a theme; unknown block types are
 * skipped so older configs keep rendering as the schema grows.
 */
export interface EventPageBlock {
  type: "hero" | "text" | "image" | "highlights";
  /** hero/text title or heading */
  heading?: string;
  /** text body / hero subtitle */
  body?: string;
  /** image block source */
  image_url?: string;
  /** highlights block bullet list */
  items?: string[];
}

export interface EventPageConfig {
  theme?: {
    primary?: string;
    accent?: string;
    cover_image_url?: string;
  };
  blocks?: EventPageBlock[];
}

export interface TicketType {
  id: string;
  event_id: string;
  name: string;
  description?: string | null;
  price_cents: number;
  currency: string;
  quantity_total: number | null;
  quantity_sold: number;
  remaining: number | null;
  min_per_order: number;
  max_per_order: number;
  sales_start_at?: string | null;
  sales_end_at?: string | null;
  attributes?: Record<string, unknown> | null;
  sort_order: number;
  is_active: boolean;
  on_sale: boolean;
}

export interface EventModel {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description?: string | null;
  venue?: string | null;
  status: EventStatus;
  starts_at: string | null;
  ends_at: string | null;
  scan_starts_at?: string | null;
  scan_ends_at?: string | null;
  page_config: EventPageConfig | null;
  ticket_types?: TicketType[];
  ticket_types_count?: number;
  orders_count?: number;
  created_at?: string;
}

export interface Ticket {
  id: string;
  ticket_order_id: string;
  ticket_type_id: string | null;
  code: string;
  attendee_name?: string | null;
  status: TicketStatus;
  checked_in_at?: string | null;
  ticket_type?: { id: string; name: string } | null;
  created_at?: string;
}

export type PaymentStatus = "pending" | "paid" | "expired" | "failed";

/** Redacted view of a tenant's Xendit payment-gateway connection. */
export interface XenditPaymentSnapshot {
  configured: boolean;
  account_label?: string | null;
  secret_key_hint?: string | null;
  callback_token_set: boolean;
  webhook_url?: string | null;
  connected_at?: string | null;
}

export interface TicketOrderPayment {
  id: string;
  provider: string;
  status: PaymentStatus;
  amount_cents: number;
  currency: string;
  invoice_url?: string | null;
  paid_at?: string | null;
}

export interface TicketOrder {
  id: string;
  event_id: string;
  guest_id: string;
  referral_id?: string | null;
  source?: string | null;
  status: TicketOrderStatus;
  subtotal_cents: number;
  total_cents: number;
  currency: string;
  tickets_count?: number;
  checked_in_count?: number;
  tickets?: Ticket[];
  guest?: { id: string; name: string; email?: string | null; phone?: string | null };
  referral?: { id: string; code: string; label?: string | null } | null;
  event?: { id: string; name: string; slug: string; starts_at: string | null; venue?: string | null };
  payment?: TicketOrderPayment | null;
  created_at?: string;
}

export interface EventReferral {
  id: string;
  event_id: string;
  code: string;
  label?: string | null;
  owner_name?: string | null;
  owner_contact?: string | null;
  clicks: number;
  orders_count: number;
  revenue_cents: number;
  is_active: boolean;
  share_url?: string | null;
  created_at?: string;
}

/* Public guest-facing event payload */
export interface PublicTicketType {
  id: string;
  name: string;
  description?: string | null;
  price_cents: number;
  currency: string;
  remaining: number | null;
  min_per_order: number;
  max_per_order: number;
  attributes?: Record<string, unknown> | null;
  on_sale: boolean;
}

export interface PublicEvent {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  venue?: string | null;
  starts_at: string | null;
  ends_at: string | null;
  page_config: EventPageConfig | null;
  tenant_timezone?: string;
  ticket_types: PublicTicketType[];
}

export interface EventSourceRow {
  source: string;
  orders: number;
  tickets: number;
  revenue_cents: number;
}

export interface EventReferralRow {
  id: string;
  event_id?: string;
  code: string;
  label?: string | null;
  clicks: number;
  orders_count: number;
  revenue_cents: number;
  conversion_percent: number;
}

export interface EventSeriesPoint {
  date: string;
  count: number;
}

export interface EventReport {
  event: {
    id: string;
    name: string;
    status: EventStatus;
    starts_at: string | null;
    scan_starts_at?: string | null;
    scan_ends_at?: string | null;
    timezone: string;
  };
  totals: {
    orders: number;
    tickets_sold: number;
    revenue_cents: number;
    checked_in: number;
    no_show: number;
    check_in_rate_percent: number;
    unique_buyers: number;
    capacity: number | null;
    sell_through_percent: number | null;
    avg_tickets_per_order: number;
    visitors: number;
    visitor_conversion_percent: number | null;
  };
  by_type: Array<{
    ticket_type_id: string;
    name: string;
    price_cents: number;
    sold: number;
    checked_in: number;
    revenue_cents: number;
    quantity_total: number | null;
  }>;
  by_source: EventSourceRow[];
  referrals: EventReferralRow[];
  check_in_series: EventSeriesPoint[];
  sales_series: EventSeriesPoint[];
}

export interface EventReportSummary {
  timezone: string;
  totals: {
    events: number;
    published_events: number;
    orders: number;
    tickets_sold: number;
    revenue_cents: number;
    checked_in: number;
    no_show: number;
    check_in_rate_percent: number;
    unique_buyers: number;
    visitors: number;
  };
  by_source: EventSourceRow[];
  by_event: Array<{
    event_id: string;
    name: string;
    status: EventStatus;
    starts_at: string | null;
    tickets_sold: number;
    checked_in: number;
    revenue_cents: number;
  }>;
  top_referrals: EventReferralRow[];
  sales_series: EventSeriesPoint[];
}

/* ===== Event ticketing payloads ===== */

export interface CreateEventPayload {
  name: string;
  starts_at: string;
  ends_at?: string | null;
  scan_starts_at?: string | null;
  scan_ends_at?: string | null;
  venue?: string | null;
  description?: string | null;
  status?: EventStatus;
  page_config?: EventPageConfig | null;
  slug?: string | null;
}

export type UpdateEventPayload = Partial<CreateEventPayload>;

export interface TicketTypePayload {
  name: string;
  description?: string | null;
  price_cents?: number;
  currency?: string;
  quantity_total?: number | null;
  min_per_order?: number;
  max_per_order?: number;
  sales_start_at?: string | null;
  sales_end_at?: string | null;
  attributes?: Record<string, unknown> | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface CreateReferralPayload {
  label?: string;
  code?: string;
  owner_name?: string;
  owner_contact?: string;
}

export interface PurchaseTicketsPayload {
  guest: { name: string; email: string; phone?: string };
  items: Array<{ ticket_type_id: string; quantity: number; attendee_names?: (string | null)[] }>;
  referral_code?: string;
  source?: string;
}

/* ----------------------------------------------------------------------- */
/* CRM                                                                      */
/* ----------------------------------------------------------------------- */

export type CrmProviderKey = "klaviyo" | "mailchimp";

export type CrmSyncStatus = "queued" | "running" | "completed" | "failed";

export interface CrmSegment {
  key: string;
  label: string;
  description: string;
  count: number;
}

export interface CrmSyncSummary {
  id: string;
  status: CrmSyncStatus;
  segment: string;
  total: number;
  synced: number;
  failed: number;
  message?: string | null;
  finished_at?: string | null;
}

export interface CrmConnection {
  provider: CrmProviderKey;
  configured: boolean;
  account_label?: string | null;
  api_key_hint?: string | null;
  list_id?: string | null;
  list_name?: string | null;
  webhook_url?: string | null;
  connected_at?: string | null;
  last_sync?: CrmSyncSummary | null;
}

export interface CrmConnectionsMap {
  klaviyo: CrmConnection;
  mailchimp: CrmConnection;
}

export interface CrmOverviewStats {
  contacts: number;
  with_email: number;
  with_phone: number;
  whatsapp_consented: number;
  email_consented: number;
  regulars: number;
  lapsed: number;
  birthdays_this_month: number;
  blacklisted: number;
}

export interface CrmOverview {
  stats: CrmOverviewStats;
  channels: { whatsapp_ready: boolean };
  segments: CrmSegment[];
  connections: CrmConnectionsMap;
}

export interface CrmAudience {
  id: string;
  name: string;
}

export type CampaignStatus = "draft" | "sending" | "sent" | "failed";

export interface CampaignSummary {
  id: string;
  name: string;
  channel: string;
  segment: string;
  message_body: string;
  status: CampaignStatus;
  audience_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  sent_at?: string | null;
  created_at: string;
}

export interface CampaignPreview {
  segment: string;
  audience_count: number;
  whatsapp_ready: boolean;
}

export interface CrmAutomationConfig {
  enabled: boolean;
  message: string;
}

export interface CrmWinbackConfig extends CrmAutomationConfig {
  min_days: number;
  cooldown_days: number;
}

export interface CrmAutomations {
  birthday: CrmAutomationConfig;
  winback: CrmWinbackConfig;
}

/* ----------------------------------------------------------------------- */
/* Floor sections (customizable table areas)                               */
/* ----------------------------------------------------------------------- */

export interface FloorSection {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  tables_count?: number;
  /** Guests may pick tables here (venue_map feature). */
  is_bookable_online?: boolean;
  /** TRUE cents (IDR × 100) — default for tables in this section. */
  default_price_cents?: number | null;
  description?: string | null;
}

/* ── Venue map (paid `venue_map` feature) ─────────────────────────────── */

import type { Bounds, Point } from "@/lib/geometry";

/** The uploaded artwork (SVG or PNG) and its intrinsic coordinate space. */
export interface VenueMapAssetRef {
  url: string;
  width: number;
  height: number;
  view_box: string;
}

/** An area outlined on the venue map, in that map's coordinate space. */
export interface VenueMapArea {
  /** Polygon vertices. Null until staff outline the section. */
  polygon: Point[] | null;
  /** Derived bounding box — what the guest map zooms to. */
  bounds: Bounds | null;
}

export interface VenueMapSectionSummary extends VenueMapArea {
  id: string;
  name: string;
  description?: string | null;
  /** TRUE cents (IDR × 100). */
  price_from_cents?: number | null;
}

/** The area-picking step: ONE venue map plus every bookable area drawn on it. */
export interface VenueMapOverview {
  enabled: boolean;
  map: VenueMapAssetRef | null;
  sections: VenueMapSectionSummary[];
}

export type VenueMapTableState = "available" | "booked" | "unfit";

export interface VenueMapTable {
  id: string;
  name: string;
  shape: string;
  min_capacity: number;
  max_capacity: number;
  /** TRUE cents (IDR × 100). */
  price_cents: number;
  state: VenueMapTableState;
  map_position: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
}

/**
 * The spot-picking step. Carries no artwork on purpose — it is the same venue
 * map the area step already loaded, and re-sending it would make the client
 * re-fetch and blink between steps.
 */
export interface VenueMapSectionTables {
  enabled: boolean;
  section: ({
    id: string;
    name: string;
    description?: string | null;
  } & VenueMapArea) | null;
  tables: VenueMapTable[];
}

/** One stored map in the staff editor snapshot. */
export interface VenueMapStaffAsset {
  id: string;
  /** Content hash — used to bust every cache layer when the artwork changes. */
  checksum: string;
  /** "image/svg+xml" | "image/png" — units are viewBox units or pixels. */
  mime: string;
  width: number;
  height: number;
  view_box: string;
}

/** Staff editor snapshot: the one venue map plus every section's area. */
export interface VenueMapStaffConfig {
  map: VenueMapStaffAsset | null;
  sections: Array<{
    id: string;
    name: string;
    is_active: boolean;
    is_bookable_online: boolean;
    default_price_cents: number | null;
    description: string | null;
    polygon: Point[] | null;
    bounds: Bounds | null;
  }>;
}

/* ── Menu ─────────────────────────────────────────────────────────────── */

export interface MenuLabel {
  id: string;
  name: string;
  /** A palette key from components/menu-label-colors.ts, never a hex. */
  color: string;
  sort_order?: number;
}

export interface MenuItem {
  id: string;
  menu_category_id?: string;
  menu_label_id: string | null;
  name: string;
  description?: string | null;
  /** TRUE cents (IDR × 100) — use formatMoney, not formatServicePrice. */
  price_cents: number;
  image_url?: string | null;
  is_active?: boolean;
  /** Staff flag: may guests pre-order this dish at all? */
  is_orderable?: boolean;
  /** Guest payload: can this dish be added right now (flag AND gateway AND mode). */
  orderable?: boolean;
  sort_order?: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
  items: MenuItem[];
}

/** Staff editor snapshot: the whole menu in one payload. */
export interface MenuConfig {
  /** off | display | order | both */
  mode: MenuMode;
  /** What the mode resolves to right now — `order` can be silently hiding it. */
  visible: boolean;
  ordering_enabled: boolean;
  /** Reported separately so the editor can name the ONE missing prerequisite. */
  addon_granted: boolean;
  gateway_connected: boolean;
  categories: MenuCategory[];
  labels: MenuLabel[];
}

export type MenuMode = "off" | "display" | "order" | "both";

/**
 * The guest-facing menu. Published by every venue; `ordering_enabled` is what
 * decides between an orderable step and a read-only one, and needs BOTH the
 * add-on and a live payment gateway.
 */
export interface PublicMenu {
  /** off | display | order | both */
  mode: string;
  /** Whether the menu step should render at all. */
  visible: boolean;
  ordering_enabled: boolean;
  categories: MenuCategory[];
  labels: MenuLabel[];
}

/** One line a guest is about to order. Prices are never sent — only ids. */
export interface MenuOrderLine {
  id: string;
  quantity: number;
}

/** One pre-ordered line on a reservation. Values are snapshots from booking time. */
export interface ReservationMenuLine {
  id: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}
