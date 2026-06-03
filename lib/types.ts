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

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
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

export interface AuthResponse {
  user: User;
  tenant: Tenant | null;
  token: string;
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
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
  created_at?: string;
  updated_at?: string;
}

export interface AvailabilitySlot {
  time: string;
  available: boolean;
  capacity?: number;
  table_ids?: string[];
}

export interface AvailabilityResponse {
  date: string;
  party_size: number;
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
  guest?: Guest;
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
  party_size: number;
  duration_mins?: number;
  guest: ReservationGuestPayload;
  special_requests?: string;
  occasion?: string;
  staff_notes?: string;
  source?: ReservationSource;
  table_id?: string;
  combination_id?: string;
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
  waitlist: PublicTenantWaitlistProfile;
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

export interface PublicAvailabilitySlot {
  time: string; // HH:MM (tenant local)
  reserved_at_utc: string; // ISO UTC
  period: string;
  available: boolean;
}

export interface PublicAvailabilityResponse {
  date: string;
  party_size: number;
  slots: PublicAvailabilitySlot[];
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
  /** Venue IANA timezone for displaying reserved_at */
  restaurant_timezone?: string;
}

export interface PublicCreateReservationPayload {
  reserved_at: string;
  party_size: number;
  duration_mins?: number;
  guest: { name: string; email: string; phone?: string | null };
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
  is_blacklisted?: boolean;
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
  webhook_url: string | null;
  api_key_hint: string | null;
}

export interface WhatsappConversation {
  id: string;
  phone_e164: string;
  contact_name?: string | null;
  guest_id?: string | null;
  guest?: { id: string; name: string; phone?: string | null } | null;
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
