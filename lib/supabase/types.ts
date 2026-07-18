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
          review_note: string | null;
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
          tier_gel_at_payment: number;
          months_covered: number;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
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
      admin_roles: {
        Row: {
          user_id: string;
          role: string;
          granted_by: string | null;
          granted_at: string;
        };
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
      admin_overview: {
        Row: {
          approved_delegates: number;
          pending_delegates: number;
          active_members: number;
          total_completed: number;
          mrr_gel: number;
        };
        Relationships: [];
      };
      admin_region_stats: {
        Row: { region_id: number; name_ka: string; member_count: number };
        Relationships: [];
      };
      admin_members: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          region_id: number | null;
          region_name_ka: string | null;
          city_name_ka: string | null;
          delegate_id: string | null;
          delegate_first_name: string | null;
          delegate_last_name: string | null;
          status: MemberStatusRow;
          membership_tier: number | null;
          reference_code: string | null;
          created_at: string;
          registration_completed_at: string | null;
          is_delegate: boolean;
        };
        Relationships: [];
      };
      admin_delegate_queue: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          region_id: number | null;
          region_name_ka: string | null;
          status: DelegateStatusRow;
          slug: string | null;
          bio: string | null;
          photo_url: string | null;
          review_note: string | null;
          tc_accepted_at: string;
          created_at: string;
          verified_at: string | null;
          verified_by_first_name: string | null;
          verified_by_last_name: string | null;
          active_supporters: number;
          total_supporters: number;
        };
        Relationships: [];
      };
      admin_payments: {
        Row: {
          id: number;
          member_id: string;
          first_name: string;
          last_name: string;
          reference_code: string | null;
          amount_gel: number;
          months_covered: number;
          paid_at: string;
          bank_reference: string | null;
          source: string;
          recorded_by_first_name: string | null;
          recorded_by_last_name: string | null;
          created_at: string;
          voided_at: string | null;
          voided_by_first_name: string | null;
          voided_by_last_name: string | null;
          void_reason: string | null;
        };
        Relationships: [];
      };
      admin_finance_stats: {
        Row: {
          mrr_gel: number;
          active_count: number;
          tier5_count: number;
          tier10_count: number;
          tier20_count: number;
        };
        Relationships: [];
      };
      admin_admins: {
        Row: {
          user_id: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          role: string;
          granted_at: string;
          granted_by_first_name: string | null;
          granted_by_last_name: string | null;
        };
        Relationships: [];
      };
      admin_audit: {
        Row: {
          id: number;
          created_at: string;
          actor_id: string | null;
          actor_first_name: string | null;
          actor_last_name: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          target_label: string | null;
          details: Json | null;
        };
        Relationships: [];
      };
      admin_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
          updated_by_first_name: string | null;
          updated_by_last_name: string | null;
        };
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
      admin_approve_delegate: {
        Args: { p_delegate_id: string; p_slug: string };
        Returns: Json;
      };
      admin_reject_delegate: {
        Args: { p_delegate_id: string; p_note: string | null };
        Returns: undefined;
      };
      admin_update_delegate_profile: {
        Args: { p_delegate_id: string; p_bio: string | null; p_photo_url: string | null };
        Returns: undefined;
      };
      admin_record_payment: {
        Args: {
          p_member_id: string;
          p_amount_gel: number;
          p_paid_at: string;
          p_bank_reference: string | null;
        };
        Returns: Json;
      };
      admin_record_payments_bulk: { Args: { p_rows: Json }; Returns: Json };
      admin_void_payment: { Args: { p_payment_id: number; p_reason: string }; Returns: Json };
      admin_reassign_member: {
        Args: { p_member_id: string; p_delegate_id: string };
        Returns: undefined;
      };
      admin_reveal_personal_id: { Args: { p_member_id: string }; Returns: string | null };
      admin_reveal_applicant_personal_id: {
        Args: { p_delegate_id: string };
        Returns: string | null;
      };
      admin_export_members: {
        Args: {
          p_search: string | null;
          p_region_id: number | null;
          p_status: string | null;
          p_include_ids: boolean;
        };
        Returns: Json;
      };
      admin_grant_role: { Args: { p_user_id: string; p_role: string }; Returns: undefined };
      admin_revoke_role: { Args: { p_user_id: string; p_role: string }; Returns: undefined };
      admin_update_setting: { Args: { p_key: string; p_value: Json }; Returns: undefined };
    };
    Enums: {
      member_status: MemberStatusRow;
      delegate_status: DelegateStatusRow;
    };
    CompositeTypes: Record<string, never>;
  };
}
