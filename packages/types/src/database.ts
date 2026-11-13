export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      assignment_submissions: {
        Row: { id: string; assignment_id: string; test_id: string; tester_id: string; report_text: string; comments: string; status: string; submitted_at: string; reviewed_by: string | null; reviewed_at: string | null; review_note: string | null; created_at: string }
        Insert: { id?: string; assignment_id: string; test_id: string; tester_id: string; report_text: string; comments?: string; status?: string; submitted_at?: string; reviewed_by?: string | null; reviewed_at?: string | null; review_note?: string | null; created_at?: string }
        Update: { id?: string; assignment_id?: string; test_id?: string; tester_id?: string; report_text?: string; comments?: string; status?: string; submitted_at?: string; reviewed_by?: string | null; reviewed_at?: string | null; review_note?: string | null; created_at?: string }
        Relationships: [
          { foreignKeyName: "assignment_submissions_assignment_fk"; columns: ["assignment_id", "test_id", "tester_id"]; isOneToOne: true; referencedRelation: "assignments"; referencedColumns: ["id", "test_id", "tester_id"] }
        ]
      }
      assignment_submission_attachments: {
        Row: { id: string; submission_id: string; assignment_id: string; test_id: string; tester_id: string; storage_path: string; original_filename: string; mime_type: string; size_bytes: number; created_at: string }
        Insert: { id?: string; submission_id: string; assignment_id: string; test_id: string; tester_id: string; storage_path: string; original_filename: string; mime_type: string; size_bytes: number; created_at?: string }
        Update: { id?: string; submission_id?: string; assignment_id?: string; test_id?: string; tester_id?: string; storage_path?: string; original_filename?: string; mime_type?: string; size_bytes?: number; created_at?: string }
        Relationships: [
          { foreignKeyName: "assignment_submission_attachment_owner_fk"; columns: ["submission_id", "assignment_id", "test_id", "tester_id"]; isOneToOne: false; referencedRelation: "assignment_submissions"; referencedColumns: ["id", "assignment_id", "test_id", "tester_id"] }
        ]
      }
      apps: {
        Row: {
          archived_from_status: string | null
          category: string
          created_at: string
          description: string | null
          developer_id: string
          icon_url: string | null
          id: string
          name: string
          package_name: string
          play_store_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          archived_from_status?: string | null
          category?: string
          created_at?: string
          description?: string | null
          developer_id: string
          icon_url?: string | null
          id?: string
          name: string
          package_name: string
          play_store_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          archived_from_status?: string | null
          category?: string
          created_at?: string
          description?: string | null
          developer_id?: string
          icon_url?: string | null
          id?: string
          name?: string
          package_name?: string
          play_store_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apps_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          auto_validation_at: string | null
          cohort_id: string
          completed_at: string | null
          created_at: string
          developer_confirmed_at: string | null
          id: string
          medical_exception_approved_at: string | null
          medical_exception_approved_by: string | null
          medical_exception_note: string | null
          medical_extension_days: number
          start_date: string | null
          status: string
          test_id: string
          tester_id: string
          updated_at: string
        }
        Insert: {
          auto_validation_at?: string | null
          cohort_id: string
          completed_at?: string | null
          created_at?: string
          developer_confirmed_at?: string | null
          id?: string
          medical_exception_approved_at?: string | null
          medical_exception_approved_by?: string | null
          medical_exception_note?: string | null
          medical_extension_days?: number
          start_date?: string | null
          status?: string
          test_id: string
          tester_id: string
          updated_at?: string
        }
        Update: {
          auto_validation_at?: string | null
          cohort_id?: string
          completed_at?: string | null
          created_at?: string
          developer_confirmed_at?: string | null
          id?: string
          medical_exception_approved_at?: string | null
          medical_exception_approved_by?: string | null
          medical_exception_note?: string | null
          medical_extension_days?: number
          start_date?: string | null
          status?: string
          test_id?: string
          tester_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_cohort_test_fk"
            columns: ["cohort_id", "test_id"]
            isOneToOne: false
            referencedRelation: "cohort_tests"
            referencedColumns: ["cohort_id", "test_id"]
          },
          {
            foreignKeyName: "assignments_cohort_tester_fk"
            columns: ["cohort_id", "tester_id"]
            isOneToOne: false
            referencedRelation: "cohort_tests"
            referencedColumns: ["cohort_id", "developer_id"]
          },
          {
            foreignKeyName: "assignments_medical_exception_approved_by_fkey"
            columns: ["medical_exception_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_tester_id_fkey"
            columns: ["tester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          assignment_id: string
          checkin_date: string
          created_at: string
          evidence_url: string | null
          id: string
          note: string | null
          tester_id: string
        }
        Insert: {
          assignment_id: string
          checkin_date: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          note?: string | null
          tester_id: string
        }
        Update: {
          assignment_id?: string
          checkin_date?: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          note?: string | null
          tester_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_tester_id_fkey"
            columns: ["tester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_tests: {
        Row: {
          added_at: string
          cohort_id: string
          developer_id: string
          is_active: boolean
          test_id: string
        }
        Insert: {
          added_at?: string
          cohort_id: string
          developer_id: string
          is_active?: boolean
          test_id: string
        }
        Update: {
          added_at?: string
          cohort_id?: string
          developer_id?: string
          is_active?: boolean
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_tests_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_tests_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_tests_test_developer_fk"
            columns: ["test_id", "developer_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id", "developer_id"]
          },
          {
            foreignKeyName: "cohort_tests_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          capacity: number
          created_at: string
          id: string
          name: string
          priority_snapshot: Json
          status: string
          updated_at: string
        }
        Insert: {
          capacity: number
          created_at?: string
          id?: string
          name: string
          priority_snapshot?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          name?: string
          priority_snapshot?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          id: string
          payment_id: string | null
          redeemed_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          payment_id?: string | null
          redeemed_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          payment_id?: string | null
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          metadata: Json
          redemption_count: number
          starts_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          metadata?: Json
          redemption_count?: number
          starts_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          metadata?: Json
          redemption_count?: number
          starts_at?: string | null
        }
        Relationships: []
      }
      developer_feedback_reviews: {
        Row: {
          created_at: string
          developer_id: string
          feedback_id: string
          id: string
          resolution_note: string | null
          resolved_at: string | null
          status: string
          priority: string
          updated_at: string
        }
        Insert: {
          developer_id: string
          feedback_id: string
          resolution_note?: string | null
          status?: string
          priority?: string
        }
        Update: {
          resolution_note?: string | null
          status?: string
          priority?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_feedback_reviews_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_feedback_reviews_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: true
            referencedRelation: "feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_feedback_messages: {
        Row: {
          body: string
          created_at: string
          feedback_id: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          feedback_id: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          feedback_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_feedback_messages_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_feedback_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      developer_feedback_attachments: {
        Row: {
          created_at: string
          feedback_id: string
          id: string
          message_id: string
          mime_type: string
          original_filename: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          feedback_id: string
          id?: string
          message_id: string
          mime_type: string
          original_filename: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          feedback_id?: string
          id?: string
          message_id?: string
          mime_type?: string
          original_filename?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_feedback_attachments_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_feedback_attachments_message_fk"
            columns: ["feedback_id", "message_id"]
            isOneToOne: false
            referencedRelation: "developer_feedback_messages"
            referencedColumns: ["feedback_id", "id"]
          },
          {
            foreignKeyName: "developer_feedback_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      developer_feedback_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          feedback_id: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          feedback_id: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          feedback_id?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "developer_feedback_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_feedback_events_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback"
            referencedColumns: ["id"]
          }
        ]
      }
      devices: {
        Row: {
          app_version: string | null
          created_at: string
          fingerprint_hash: string
          first_seen_at: string
          id: string
          last_seen_at: string
          platform: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          fingerprint_hash: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          fingerprint_hash?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          created_at: string
          id: string
          opened_by: string
          payment_id: string | null
          report_id: string | null
          resolution: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          opened_by: string
          payment_id?: string | null
          report_id?: string | null
          resolution?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          opened_by?: string
          payment_id?: string | null
          report_id?: string | null
          resolution?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          aggregate_id: string | null
          aggregate_type: string
          attempts: number
          available_at: string
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          status: string
        }
        Insert: {
          aggregate_id?: string | null
          aggregate_type: string
          attempts?: number
          available_at?: string
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Update: {
          aggregate_id?: string | null
          aggregate_type?: string
          attempts?: number
          available_at?: string
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Relationships: []
      }
      feature_usage: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          metadata: Json
          period_start: string
          usage_count: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          metadata?: Json
          period_start?: string
          usage_count?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          metadata?: Json
          period_start?: string
          usage_count?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          assignment_id: string
          body: string
          category: string
          created_at: string
          id: string
          quality_status: string
          rating: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          tester_id: string
        }
        Insert: {
          assignment_id: string
          body: string
          category?: string
          created_at?: string
          id?: string
          quality_status?: string
          rating?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          tester_id: string
        }
        Update: {
          assignment_id?: string
          body?: string
          category?: string
          created_at?: string
          id?: string
          quality_status?: string
          rating?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          tester_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_tester_id_fkey"
            columns: ["tester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_events: {
        Row: {
          created_at: string
          evidence: Json
          id: string
          occurred_at: string
          signal_code: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          evidence?: Json
          id?: string
          occurred_at?: string
          signal_code: string
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          evidence?: Json
          id?: string
          occurred_at?: string
          signal_code?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "fraud_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_reviews: {
        Row: {
          created_at: string
          id: string
          priority: string
          resolution: string | null
          review_due_at: string | null
          reviewed_by: string | null
          score: number
          signals: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          priority?: string
          resolution?: string | null
          review_due_at?: string | null
          reviewed_by?: string | null
          score: number
          signals?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          priority?: string
          resolution?: string | null
          review_due_at?: string | null
          reviewed_by?: string | null
          score?: number
          signals?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_exception_requests: {
        Row: {
          assignment_id: string
          created_at: string
          evidence_storage_path: string | null
          id: string
          reason: string
          requested_dates: string[] | null
          requested_days: number
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tester_id: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          evidence_storage_path?: string | null
          id?: string
          reason: string
          requested_dates?: string[] | null
          requested_days: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tester_id: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          evidence_storage_path?: string | null
          id?: string
          reason?: string
          requested_dates?: string[] | null
          requested_days?: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tester_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_exception_requests_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_exception_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_exception_requests_tester_id_fkey"
            columns: ["tester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          archived_at: string | null
          body: string
          created_at: string
          data: Json
          id: string
          read_at: string | null
          recipient_role: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          body: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          recipient_role: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          body?: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          recipient_role?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_dzd: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          provider: string
          provider_payment_id: string | null
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          amount_dzd: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key: string
          provider: string
          provider_payment_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          amount_dzd?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          provider?: string
          provider_payment_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_period: string
          code: string
          created_at: string
          features: Json
          id: string
          is_active: boolean
          limits: Json
          name: string
          price_dzd: number
          updated_at: string
        }
        Insert: {
          billing_period?: string
          code: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          name: string
          price_dzd?: number
          updated_at?: string
        }
        Update: {
          billing_period?: string
          code?: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          name?: string
          price_dzd?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      play_opt_in_events: {
        Row: {
          assignment_id: string
          created_at: string
          event_type: string
          evidence_url: string | null
          id: string
          notes: string | null
          occurred_at: string
          recorded_by: string | null
          tester_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          event_type: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          occurred_at: string
          recorded_by?: string | null
          tester_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          event_type?: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          recorded_by?: string | null
          tester_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_opt_in_events_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "play_opt_in_events_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "play_opt_in_events_tester_id_fkey"
            columns: ["tester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          idempotency_key: string
          reason: string
          reference_id: string | null
          reference_type: string | null
          reversal_of: string | null
          user_id: string
          wallet_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          idempotency_key: string
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          reversal_of?: string | null
          user_id: string
          wallet_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          reversal_of?: string | null
          user_id?: string
          wallet_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "points_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          interests: Json
          is_banned: boolean
          is_verified: boolean
          locale: string
          onboarding_completed_at: string | null
          phone: string | null
          subscription_tier: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          interests?: Json
          is_banned?: boolean
          is_verified?: boolean
          locale?: string
          onboarding_completed_at?: string | null
          phone?: string | null
          subscription_tier?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          interests?: Json
          is_banned?: boolean
          is_verified?: boolean
          locale?: string
          onboarding_completed_at?: string | null
          phone?: string | null
          subscription_tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          qualified_at: string | null
          referral_code: string
          referred_user_id: string
          referrer_id: string
          rewarded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          qualified_at?: string | null
          referral_code: string
          referred_user_id: string
          referrer_id: string
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          qualified_at?: string | null
          referral_code?: string
          referred_user_id?: string
          referrer_id?: string
          rewarded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_dzd: number
          approved_by: string | null
          audit_log_id: string | null
          bank_reference: string | null
          created_at: string
          id: string
          payment_id: string
          reason: string
          refund_method: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_dzd: number
          approved_by?: string | null
          audit_log_id?: string | null
          bank_reference?: string | null
          created_at?: string
          id?: string
          payment_id: string
          reason: string
          refund_method: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_dzd?: number
          approved_by?: string | null
          audit_log_id?: string | null
          bank_reference?: string | null
          created_at?: string
          id?: string
          payment_id?: string
          reason?: string
          refund_method?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_attachments: {
        Row: {
          assignment_id: string
          created_at: string
          file_extension: string
          file_id: string
          id: string
          original_filename: string
          report_id: string
          storage_path: string | null
          test_id: string
          tester_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          file_extension: string
          file_id: string
          id?: string
          original_filename: string
          report_id: string
          storage_path?: string | null
          test_id: string
          tester_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          file_extension?: string
          file_id?: string
          id?: string
          original_filename?: string
          report_id?: string
          storage_path?: string | null
          test_id?: string
          tester_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_attachments_assignment_test_tester_fk"
            columns: ["assignment_id", "test_id", "tester_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id", "test_id", "tester_id"]
          },
          {
            foreignKeyName: "report_attachments_report_assignment_fk"
            columns: ["report_id", "assignment_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id", "assignment_id"]
          },
          {
            foreignKeyName: "report_attachments_tester_profile_fk"
            columns: ["tester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          assignment_id: string | null
          created_at: string
          description: string
          id: string
          report_type: string
          reported_user_id: string | null
          reporter_id: string
          status: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          description: string
          id?: string
          report_type: string
          reported_user_id?: string | null
          reporter_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          description?: string
          id?: string
          report_type?: string
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan_id: string
          provider: string | null
          provider_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end: string
          current_period_start: string
          id?: string
          plan_id: string
          provider?: string | null
          provider_subscription_id?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id?: string
          provider?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_attachments: {
        Row: {
          created_at: string
          id: string
          message_id: string
          mime_type: string
          original_filename: string
          size_bytes: number
          storage_path: string
          ticket_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          mime_type: string
          original_filename: string
          size_bytes: number
          storage_path: string
          ticket_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          mime_type?: string
          original_filename?: string
          size_bytes?: number
          storage_path?: string
          ticket_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_attachments_message_fk"
            columns: ["ticket_id", "message_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_messages"
            referencedColumns: ["ticket_id", "id"]
          },
          {
            foreignKeyName: "support_ticket_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          new_priority: string | null
          new_status: string | null
          old_priority: string | null
          old_status: string | null
          ticket_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          new_priority?: string | null
          new_status?: string | null
          old_priority?: string | null
          old_status?: string | null
          ticket_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          new_priority?: string | null
          new_status?: string | null
          old_priority?: string | null
          old_status?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          priority: string
          requester_role: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          ticket_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          priority?: string
          requester_role?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          ticket_number?: never
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          requester_role?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          ticket_number?: never
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      test_media: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          media_type: string
          sort_order: number
          storage_path: string
          test_id: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          media_type: string
          sort_order?: number
          storage_path: string
          test_id: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          media_type?: string
          sort_order?: number
          storage_path?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_media_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_requirements: {
        Row: {
          created_at: string
          description: string
          id: string
          is_mandatory: boolean
          requirement_type: string
          sort_order: number
          test_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_mandatory?: boolean
          requirement_type?: string
          sort_order?: number
          test_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_mandatory?: boolean
          requirement_type?: string
          sort_order?: number
          test_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_requirements_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_steps: {
        Row: {
          created_at: string
          description: string
          id: string
          is_required: boolean
          step_order: number
          test_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_required?: boolean
          step_order: number
          test_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_required?: boolean
          step_order?: number
          test_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_steps_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          android_max_api: number | null
          android_min_api: number | null
          app_id: string
          created_at: string
          description: string | null
          developer_id: string
          device_requirements: Json
          eligibility_criteria: Json
          end_date: string | null
          estimated_duration_minutes: number | null
          id: string
          min_testers: number
          short_summary: string | null
          start_date: string | null
          status: string
          tester_instructions: string | null
          title: string
          updated_at: string
        }
        Insert: {
          android_max_api?: number | null
          android_min_api?: number | null
          app_id: string
          created_at?: string
          description?: string | null
          developer_id: string
          device_requirements?: Json
          eligibility_criteria?: Json
          end_date?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          min_testers?: number
          short_summary?: string | null
          start_date?: string | null
          status?: string
          tester_instructions?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          android_max_api?: number | null
          android_min_api?: number | null
          app_id?: string
          created_at?: string
          description?: string | null
          developer_id?: string
          device_requirements?: Json
          eligibility_criteria?: Json
          end_date?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          min_testers?: number
          short_summary?: string | null
          start_date?: string | null
          status?: string
          tester_instructions?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tests_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tests_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          earned_points: number
          purchased_credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          earned_points?: number
          purchased_credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          earned_points?: number
          purchased_credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      submit_assignment_checkin: {
        Args: { p_assignment_id: string; p_note?: string | null }
        Returns: Json
      }
      submit_assignment_report: {
        Args: { p_assignment_id: string; p_report_text: string; p_comments?: string; p_files?: Json }
        Returns: Json
      }
      review_assignment_submission: {
        Args: { p_submission_id: string; p_decision: string; p_review_note?: string | null }
        Returns: Json
      }

      add_cohort_test: {
        Args: { p_cohort_id: string; p_test_id: string }
        Returns: number
      }
      archive_app: { Args: { p_app_id: string }; Returns: undefined }
      complete_onboarding: {
        Args: { p_interests?: Json; p_roles: string[] }
        Returns: Json
      }
      create_app: {
        Args: {
          p_category: string
          p_description: string
          p_name: string
          p_package_name: string
        }
        Returns: string
      }
      create_cohort: {
        Args: { p_capacity: number; p_name: string; p_test_ids: string[] }
        Returns: string
      }
      get_active_subscription: {
        Args: never
        Returns: {
          expires_at: string
          features: Json
          limits: Json
          plan_code: string
        }[]
      }
      get_app_limit: {
        Args: never
        Returns: {
          can_create: boolean
          current_active_apps: number
          max_active_apps: number
          plan_code: string
        }[]
      }
      get_my_active_sessions: {
        Args: never
        Returns: {
          assurance_level: string
          created_at: string
          id: string
          ip_address: string
          is_current: boolean
          last_active_at: string
          user_agent: string
        }[]
      }
      get_my_security_activity: {
        Args: { p_limit?: number }
        Returns: {
          event: string
          id: string
          ip_address: string
          occurred_at: string
        }[]
      }
      remove_cohort_test: {
        Args: { p_cohort_id: string; p_test_id: string }
        Returns: number
      }
      restore_app: { Args: { p_app_id: string }; Returns: undefined }
      review_medical_exception: {
        Args: {
          p_decision: string
          p_request_id: string
          p_review_note?: string
        }
        Returns: {
          assignment_id: string
          created_at: string
          evidence_storage_path: string | null
          id: string
          reason: string
          requested_dates: string[] | null
          requested_days: number
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tester_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "medical_exception_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_app: {
        Args: {
          p_app_id: string
          p_category: string
          p_description: string
          p_icon_url?: string
          p_name: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
