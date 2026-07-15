/**
 * Hand-maintained Database definitions (ADR-005: staging is the only database,
 * no local Docker — so no `supabase gen types`). Source of truth:
 * supabase/migrations/*. Update this file in the same commit as any migration.
 * Only columns/functions app code touches are listed; additive DB drift is
 * harmless at runtime. Insert/Update are `never` where no typed-client code
 * path writes the table — RPCs, SQL and untyped script clients do instead.
 * `Relationships: []` on every table/view is required structurally by
 * @supabase/postgrest-js's `GenericTable`/`GenericView` (without it the whole
 * schema fails its internal `extends` check and query results silently type as
 * `never`) — empty because no query in this app uses embedded-resource selects
 * (`.select("*, other_table(...)")`); populate real FK entries here if one ever
 * does.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MemberStatusRow = "draft" | "profile_completed" | "active_member";
export type DelegateStatusRow = "pending" | "approved" | "rejected";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          personal_id: string | null;
          birth_date: string | null;
          region_id: number | null;
          city_id: number | null;
          employment: string | null;
          status: MemberStatusRow;
          signup_role: "member" | "delegate";
          signup_ref_code: string | null;
          membership_tier: number | null;
          reference_code: string | null;
          registration_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        // Type-level mirror of the Phase 3 column-scoped UPDATE grant (spec §4.1).
        Update: {
          first_name?: string;
          last_name?: string;
          region_id?: number;
          city_id?: number;
          employment?: string;
        };
        Relationships: [];
      };
      delegates: {
        Row: {
          id: string;
          status: DelegateStatusRow;
          referral_code: string;
          slug: string | null;
          bio: string | null;
          photo_url: string | null;
          tc_accepted_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      memberships: {
        Row: {
          id: number;
          member_id: string;
          delegate_id: string | null;
          started_at: string;
          ended_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      payments: {
        Row: {
          id: number;
          member_id: string;
          amount_gel: number;
          paid_at: string;
          bank_reference: string | null;
          source: string;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      regions: {
        Row: { id: number; name_ka: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      cities: {
        Row: { id: number; region_id: number; name_ka: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      dev_otp_inbox: {
        Row: { id: number; phone: string; otp: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      public_delegates: {
        Row: {
          id: string;
          slug: string | null;
          first_name: string;
          last_name: string;
          region_id: number | null;
          region_name_ka: string | null;
          bio: string | null;
          photo_url: string | null;
          active_supporters: number;
        };
        Relationships: [];
      };
      public_stats: {
        Row: { approved_delegates: number; active_members: number };
        Relationships: [];
      };
    };
    Functions: {
      funnel_state: { Args: Record<PropertyKey, never>; Returns: Json };
      funnel_start: {
        Args: {
          p_first_name: string;
          p_last_name: string;
          p_role: string;
          p_ref_code: string | null;
        };
        Returns: Json;
      };
      funnel_save_profile: {
        Args: {
          p_personal_id: string;
          p_birth_date: string;
          p_region_id: number;
          p_city_id: number;
          p_employment: string;
          p_delegate_id: string | null;
          p_tc_accepted: boolean;
        };
        Returns: Json;
      };
      funnel_complete: { Args: { p_tier: number }; Returns: Json };
      member_change_delegate: { Args: { p_delegate_id: string | null }; Returns: Json };
      member_change_tier: { Args: { p_tier: number }; Returns: Json };
      delegate_panel: { Args: Record<PropertyKey, never>; Returns: Json };
      delegate_team: { Args: Record<PropertyKey, never>; Returns: Json };
    };
    Enums: {
      member_status: MemberStatusRow;
      delegate_status: DelegateStatusRow;
    };
    CompositeTypes: Record<string, never>;
  };
}
