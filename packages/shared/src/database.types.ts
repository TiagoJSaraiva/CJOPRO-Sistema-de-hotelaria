export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      catalog_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["catalog_audit_entity"]
          hotel_id: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["catalog_audit_entity"]
          hotel_id: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["catalog_audit_entity"]
          hotel_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_audit_events_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_agreement_revision_points: {
        Row: {
          created_at: string
          hotel_id: string
          id: string
          last_changed_by: string | null
          point_id: string
          revision_id: string
        }
        Insert: {
          created_at?: string
          hotel_id: string
          id?: string
          last_changed_by?: string | null
          point_id: string
          revision_id: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          id?: string
          last_changed_by?: string | null
          point_id?: string
          revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_agreement_revision_points_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_agreement_revision_points_last_changed_by_fkey"
            columns: ["last_changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_agreement_revision_points_point_hotel_fkey"
            columns: ["point_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_points"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "commercial_agreement_revision_points_revision_hotel_fkey"
            columns: ["revision_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "commercial_agreement_revisions"
            referencedColumns: ["id", "hotel_id"]
          },
        ]
      }
      commercial_agreement_revisions: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          agreement_id: string
          commercial_model: Database["public"]["Enums"]["commercial_model"]
          commission_percentage: number | null
          created_at: string
          currency: string
          ends_on: string | null
          fixed_rent: number | null
          hotel_id: string
          id: string
          last_changed_by: string | null
          minimum_guarantee: number | null
          notes: string | null
          payment_recipient: Database["public"]["Enums"]["commercial_payment_recipient"]
          rent_frequency:
            | Database["public"]["Enums"]["commercial_rent_frequency"]
            | null
          starts_on: string
          status: Database["public"]["Enums"]["commercial_revision_status"]
          terminated_at: string | null
          terminated_by: string | null
          updated_at: string
          version: number
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          agreement_id: string
          commercial_model: Database["public"]["Enums"]["commercial_model"]
          commission_percentage?: number | null
          created_at?: string
          currency: string
          ends_on?: string | null
          fixed_rent?: number | null
          hotel_id: string
          id?: string
          last_changed_by?: string | null
          minimum_guarantee?: number | null
          notes?: string | null
          payment_recipient: Database["public"]["Enums"]["commercial_payment_recipient"]
          rent_frequency?:
            | Database["public"]["Enums"]["commercial_rent_frequency"]
            | null
          starts_on: string
          status?: Database["public"]["Enums"]["commercial_revision_status"]
          terminated_at?: string | null
          terminated_by?: string | null
          updated_at?: string
          version: number
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          agreement_id?: string
          commercial_model?: Database["public"]["Enums"]["commercial_model"]
          commission_percentage?: number | null
          created_at?: string
          currency?: string
          ends_on?: string | null
          fixed_rent?: number | null
          hotel_id?: string
          id?: string
          last_changed_by?: string | null
          minimum_guarantee?: number | null
          notes?: string | null
          payment_recipient?: Database["public"]["Enums"]["commercial_payment_recipient"]
          rent_frequency?:
            | Database["public"]["Enums"]["commercial_rent_frequency"]
            | null
          starts_on?: string
          status?: Database["public"]["Enums"]["commercial_revision_status"]
          terminated_at?: string | null
          terminated_by?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercial_agreement_revisions_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_agreement_revisions_agreement_hotel_fkey"
            columns: ["agreement_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "commercial_agreements"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "commercial_agreement_revisions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_agreement_revisions_last_changed_by_fkey"
            columns: ["last_changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_agreement_revisions_terminated_by_fkey"
            columns: ["terminated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_agreements: {
        Row: {
          archived_at: string | null
          created_at: string
          hotel_id: string
          id: string
          internal_number: string
          last_changed_by: string | null
          partner_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          hotel_id: string
          id?: string
          internal_number: string
          last_changed_by?: string | null
          partner_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          hotel_id?: string
          id?: string
          internal_number?: string
          last_changed_by?: string | null
          partner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_agreements_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_agreements_last_changed_by_fkey"
            columns: ["last_changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_agreements_partner_hotel_fkey"
            columns: ["partner_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "commercial_partners"
            referencedColumns: ["id", "hotel_id"]
          },
        ]
      }
      commercial_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["commercial_audit_entity"]
          hotel_id: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["commercial_audit_entity"]
          hotel_id: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["commercial_audit_entity"]
          hotel_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_audit_events_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_partner_contacts: {
        Row: {
          archived_at: string | null
          created_at: string
          email: string | null
          hotel_id: string
          id: string
          is_active: boolean
          is_primary: boolean
          last_changed_by: string | null
          name: string
          partner_id: string
          phone: string | null
          purpose: Database["public"]["Enums"]["commercial_contact_purpose"]
          role: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          hotel_id: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          last_changed_by?: string | null
          name: string
          partner_id: string
          phone?: string | null
          purpose?: Database["public"]["Enums"]["commercial_contact_purpose"]
          role?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          hotel_id?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          last_changed_by?: string | null
          name?: string
          partner_id?: string
          phone?: string | null
          purpose?: Database["public"]["Enums"]["commercial_contact_purpose"]
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_partner_contacts_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_partner_contacts_last_changed_by_fkey"
            columns: ["last_changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_partner_contacts_partner_hotel_fkey"
            columns: ["partner_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "commercial_partners"
            referencedColumns: ["id", "hotel_id"]
          },
        ]
      }
      commercial_partners: {
        Row: {
          archived_at: string | null
          created_at: string
          email: string | null
          hotel_id: string
          id: string
          is_active: boolean
          last_changed_by: string | null
          legal_name: string
          notes: string | null
          phone: string | null
          tax_id: string | null
          trade_name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          hotel_id: string
          id?: string
          is_active?: boolean
          last_changed_by?: string | null
          legal_name: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          trade_name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          hotel_id?: string
          id?: string
          is_active?: boolean
          last_changed_by?: string | null
          legal_name?: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          trade_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_partners_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_partners_last_changed_by_fkey"
            columns: ["last_changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      consumption_configuration_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["consumption_configuration_entity"]
          hotel_id: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["consumption_configuration_entity"]
          hotel_id: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["consumption_configuration_entity"]
          hotel_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumption_configuration_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_configuration_audit_events_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      consumption_correction_items: {
        Row: {
          additional_discount: number
          correction_id: string
          created_at: string
          hotel_id: string
          id: string
          order_item_id: string
          previous_discount: number
          previous_net: number
          previous_quantity: number
          resulting_net: number
          resulting_quantity: number
        }
        Insert: {
          additional_discount: number
          correction_id: string
          created_at?: string
          hotel_id: string
          id?: string
          order_item_id: string
          previous_discount: number
          previous_net: number
          previous_quantity: number
          resulting_net: number
          resulting_quantity: number
        }
        Update: {
          additional_discount?: number
          correction_id?: string
          created_at?: string
          hotel_id?: string
          id?: string
          order_item_id?: string
          previous_discount?: number
          previous_net?: number
          previous_quantity?: number
          resulting_net?: number
          resulting_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "consumption_correction_items_correction_hotel_fkey"
            columns: ["correction_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_corrections"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_correction_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_correction_items_order_item_hotel_fkey"
            columns: ["order_item_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_order_item_effective"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_correction_items_order_item_hotel_fkey"
            columns: ["order_item_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_order_items"
            referencedColumns: ["id", "hotel_id"]
          },
        ]
      }
      consumption_corrections: {
        Row: {
          account_version: number
          completed_at: string | null
          completed_by: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          discount_increase: number
          gross_reduction: number
          hotel_id: string
          id: string
          kind: Database["public"]["Enums"]["consumption_correction_kind"]
          net_reduction: number
          order_id: string
          reason: string
          requested_at: string
          requested_by: string
          status: Database["public"]["Enums"]["consumption_correction_status"]
          stay_id: string | null
        }
        Insert: {
          account_version: number
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          discount_increase: number
          gross_reduction: number
          hotel_id: string
          id?: string
          kind: Database["public"]["Enums"]["consumption_correction_kind"]
          net_reduction: number
          order_id: string
          reason: string
          requested_at?: string
          requested_by: string
          status: Database["public"]["Enums"]["consumption_correction_status"]
          stay_id?: string | null
        }
        Update: {
          account_version?: number
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          discount_increase?: number
          gross_reduction?: number
          hotel_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["consumption_correction_kind"]
          net_reduction?: number
          order_id?: string
          reason?: string
          requested_at?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["consumption_correction_status"]
          stay_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumption_corrections_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_corrections_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_corrections_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_corrections_order_hotel_fkey"
            columns: ["order_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_order_effective"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_corrections_order_hotel_fkey"
            columns: ["order_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_orders"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_corrections_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      consumption_offers: {
        Row: {
          allowed_billing_modes:
            | Database["public"]["Enums"]["consumption_billing_mode"][]
            | null
          archived_at: string | null
          commercial_agreement_id: string | null
          created_at: string
          default_billing_mode:
            | Database["public"]["Enums"]["consumption_billing_mode"]
            | null
          display_order: number
          hotel_id: string
          id: string
          is_active: boolean
          last_changed_by: string | null
          point_id: string
          policy_source: Database["public"]["Enums"]["consumption_policy_source"]
          product_id: string
          updated_at: string
        }
        Insert: {
          allowed_billing_modes?:
            | Database["public"]["Enums"]["consumption_billing_mode"][]
            | null
          archived_at?: string | null
          commercial_agreement_id?: string | null
          created_at?: string
          default_billing_mode?:
            | Database["public"]["Enums"]["consumption_billing_mode"]
            | null
          display_order?: number
          hotel_id: string
          id?: string
          is_active?: boolean
          last_changed_by?: string | null
          point_id: string
          policy_source?: Database["public"]["Enums"]["consumption_policy_source"]
          product_id: string
          updated_at?: string
        }
        Update: {
          allowed_billing_modes?:
            | Database["public"]["Enums"]["consumption_billing_mode"][]
            | null
          archived_at?: string | null
          commercial_agreement_id?: string | null
          created_at?: string
          default_billing_mode?:
            | Database["public"]["Enums"]["consumption_billing_mode"]
            | null
          display_order?: number
          hotel_id?: string
          id?: string
          is_active?: boolean
          last_changed_by?: string | null
          point_id?: string
          policy_source?: Database["public"]["Enums"]["consumption_policy_source"]
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumption_offers_agreement_hotel_fkey"
            columns: ["commercial_agreement_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "commercial_agreements"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_offers_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_offers_last_changed_by_fkey"
            columns: ["last_changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_offers_point_hotel_fkey"
            columns: ["point_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_points"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_offers_product_hotel_fkey"
            columns: ["product_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "hotel_id"]
          },
        ]
      }
      consumption_order_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          hotel_id: string
          id: string
          order_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          hotel_id: string
          id?: string
          order_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          hotel_id?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumption_order_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_order_events_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_order_events_order_hotel_fkey"
            columns: ["order_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_order_effective"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_order_events_order_hotel_fkey"
            columns: ["order_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_orders"
            referencedColumns: ["id", "hotel_id"]
          },
        ]
      }
      consumption_order_items: {
        Row: {
          agreement_number_snapshot: string | null
          billing_policy_snapshot: Json
          category_id: string | null
          category_name_snapshot: string
          charged_unit_price: number
          commercial_agreement_id: string | null
          commercial_partner_id: string | null
          commercial_revision_id: string | null
          commercial_revision_version_snapshot: number | null
          commercial_terms_snapshot: Json | null
          created_at: string
          discount_amount: number
          hotel_id: string
          id: string
          item_total_amount: number | null
          net_amount: number | null
          notes: string | null
          offer_id: string | null
          order_id: string
          partner_name_snapshot: string | null
          product_id: string
          product_internal_code_snapshot: string | null
          product_kind_snapshot: Database["public"]["Enums"]["product_kind"]
          product_name_snapshot: string
          provider_type_snapshot: Database["public"]["Enums"]["product_provider_type"]
          quantity: number
          sales_unit_snapshot: Database["public"]["Enums"]["product_sales_unit"]
          version_token: string
        }
        Insert: {
          agreement_number_snapshot?: string | null
          billing_policy_snapshot: Json
          category_id?: string | null
          category_name_snapshot: string
          charged_unit_price: number
          commercial_agreement_id?: string | null
          commercial_partner_id?: string | null
          commercial_revision_id?: string | null
          commercial_revision_version_snapshot?: number | null
          commercial_terms_snapshot?: Json | null
          created_at?: string
          discount_amount?: number
          hotel_id: string
          id?: string
          item_total_amount?: number | null
          net_amount?: number | null
          notes?: string | null
          offer_id?: string | null
          order_id: string
          partner_name_snapshot?: string | null
          product_id: string
          product_internal_code_snapshot?: string | null
          product_kind_snapshot: Database["public"]["Enums"]["product_kind"]
          product_name_snapshot: string
          provider_type_snapshot: Database["public"]["Enums"]["product_provider_type"]
          quantity: number
          sales_unit_snapshot: Database["public"]["Enums"]["product_sales_unit"]
          version_token: string
        }
        Update: {
          agreement_number_snapshot?: string | null
          billing_policy_snapshot?: Json
          category_id?: string | null
          category_name_snapshot?: string
          charged_unit_price?: number
          commercial_agreement_id?: string | null
          commercial_partner_id?: string | null
          commercial_revision_id?: string | null
          commercial_revision_version_snapshot?: number | null
          commercial_terms_snapshot?: Json | null
          created_at?: string
          discount_amount?: number
          hotel_id?: string
          id?: string
          item_total_amount?: number | null
          net_amount?: number | null
          notes?: string | null
          offer_id?: string | null
          order_id?: string
          partner_name_snapshot?: string | null
          product_id?: string
          product_internal_code_snapshot?: string | null
          product_kind_snapshot?: Database["public"]["Enums"]["product_kind"]
          product_name_snapshot?: string
          provider_type_snapshot?: Database["public"]["Enums"]["product_provider_type"]
          quantity?: number
          sales_unit_snapshot?: Database["public"]["Enums"]["product_sales_unit"]
          version_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumption_order_items_agreement_hotel_fkey"
            columns: ["commercial_agreement_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "commercial_agreements"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_order_items_category_hotel_fkey"
            columns: ["category_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_order_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_order_items_offer_hotel_fkey"
            columns: ["offer_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_offers"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_order_items_order_hotel_fkey"
            columns: ["order_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_order_effective"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_order_items_order_hotel_fkey"
            columns: ["order_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_orders"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_order_items_partner_hotel_fkey"
            columns: ["commercial_partner_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "commercial_partners"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_order_items_product_hotel_fkey"
            columns: ["product_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_order_items_revision_hotel_fkey"
            columns: ["commercial_revision_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "commercial_agreement_revisions"
            referencedColumns: ["id", "hotel_id"]
          },
        ]
      }
      consumption_orders: {
        Row: {
          billing_mode:
            | Database["public"]["Enums"]["consumption_billing_mode"]
            | null
          courtesy_reason: string | null
          currency: string
          discount_amount: number
          disposition: Database["public"]["Enums"]["consumption_order_disposition"]
          gross_amount: number
          guest_customer_id: string | null
          guest_name_snapshot: string | null
          hotel_id: string
          id: string
          idempotency_key: string | null
          is_legacy: boolean
          net_amount: number
          notes: string | null
          occurred_at: string
          partner_receipt_confirmed: boolean
          payment_method:
            | Database["public"]["Enums"]["consumption_payment_method"]
            | null
          payment_reference: string | null
          point_id: string | null
          point_name_snapshot: string | null
          posted_at: string
          posted_by: string | null
          request_fingerprint: string
          reservation_code_snapshot: string | null
          reservation_id: string | null
          room_number_snapshot: string | null
          stay_id: string | null
        }
        Insert: {
          billing_mode?:
            | Database["public"]["Enums"]["consumption_billing_mode"]
            | null
          courtesy_reason?: string | null
          currency: string
          discount_amount?: number
          disposition: Database["public"]["Enums"]["consumption_order_disposition"]
          gross_amount: number
          guest_customer_id?: string | null
          guest_name_snapshot?: string | null
          hotel_id: string
          id?: string
          idempotency_key?: string | null
          is_legacy?: boolean
          net_amount: number
          notes?: string | null
          occurred_at: string
          partner_receipt_confirmed?: boolean
          payment_method?:
            | Database["public"]["Enums"]["consumption_payment_method"]
            | null
          payment_reference?: string | null
          point_id?: string | null
          point_name_snapshot?: string | null
          posted_at?: string
          posted_by?: string | null
          request_fingerprint: string
          reservation_code_snapshot?: string | null
          reservation_id?: string | null
          room_number_snapshot?: string | null
          stay_id?: string | null
        }
        Update: {
          billing_mode?:
            | Database["public"]["Enums"]["consumption_billing_mode"]
            | null
          courtesy_reason?: string | null
          currency?: string
          discount_amount?: number
          disposition?: Database["public"]["Enums"]["consumption_order_disposition"]
          gross_amount?: number
          guest_customer_id?: string | null
          guest_name_snapshot?: string | null
          hotel_id?: string
          id?: string
          idempotency_key?: string | null
          is_legacy?: boolean
          net_amount?: number
          notes?: string | null
          occurred_at?: string
          partner_receipt_confirmed?: boolean
          payment_method?:
            | Database["public"]["Enums"]["consumption_payment_method"]
            | null
          payment_reference?: string | null
          point_id?: string | null
          point_name_snapshot?: string | null
          posted_at?: string
          posted_by?: string | null
          request_fingerprint?: string
          reservation_code_snapshot?: string | null
          reservation_id?: string | null
          room_number_snapshot?: string | null
          stay_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumption_orders_guest_customer_id_fkey"
            columns: ["guest_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_orders_guest_hotel_fkey"
            columns: ["guest_customer_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_orders_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_orders_point_hotel_fkey"
            columns: ["point_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_points"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_orders_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_orders_reservation_hotel_fkey"
            columns: ["reservation_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_orders_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_orders_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_orders_stay_reservation_fkey"
            columns: ["stay_id", "reservation_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id", "reservation_id"]
          },
        ]
      }
      consumption_points: {
        Row: {
          archived_at: string | null
          created_at: string
          default_allowed_billing_modes: Database["public"]["Enums"]["consumption_billing_mode"][]
          default_billing_mode: Database["public"]["Enums"]["consumption_billing_mode"]
          description: string | null
          display_order: number
          hotel_id: string
          id: string
          internal_code: string | null
          is_active: boolean
          last_changed_by: string | null
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          default_allowed_billing_modes: Database["public"]["Enums"]["consumption_billing_mode"][]
          default_billing_mode: Database["public"]["Enums"]["consumption_billing_mode"]
          description?: string | null
          display_order?: number
          hotel_id: string
          id?: string
          internal_code?: string | null
          is_active?: boolean
          last_changed_by?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          default_allowed_billing_modes?: Database["public"]["Enums"]["consumption_billing_mode"][]
          default_billing_mode?: Database["public"]["Enums"]["consumption_billing_mode"]
          description?: string | null
          display_order?: number
          hotel_id?: string
          id?: string
          internal_code?: string | null
          is_active?: boolean
          last_changed_by?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumption_points_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_points_last_changed_by_fkey"
            columns: ["last_changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          birth_date: string
          created_at: string
          document_number: string
          document_type: string
          email: string | null
          full_name: string
          hotel_id: string
          id: string
          mobile_phone: string | null
          nationality: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          birth_date: string
          created_at?: string
          document_number: string
          document_type: string
          email?: string | null
          full_name: string
          hotel_id: string
          id?: string
          mobile_phone?: string | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string
          created_at?: string
          document_number?: string
          document_type?: string
          email?: string | null
          full_name?: string
          hotel_id?: string
          id?: string
          mobile_phone?: string | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          category: string
          consumption_order_id: string | null
          cost_center: string | null
          counterparty: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          hotel_id: string
          id: string
          maintenance_cost_item_id: string | null
          maintenance_recovery_id: string | null
          paid_at: string | null
          payment_method: string | null
          reference_code: string | null
          reservation_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          stay_id: string | null
          stay_refund_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          consumption_order_id?: string | null
          cost_center?: string | null
          counterparty?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_date?: string | null
          hotel_id: string
          id?: string
          maintenance_cost_item_id?: string | null
          maintenance_recovery_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          reference_code?: string | null
          reservation_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          stay_id?: string | null
          stay_refund_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          consumption_order_id?: string | null
          cost_center?: string | null
          counterparty?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_date?: string | null
          hotel_id?: string
          id?: string
          maintenance_cost_item_id?: string | null
          maintenance_recovery_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          reference_code?: string | null
          reservation_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          stay_id?: string | null
          stay_refund_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_consumption_order_fkey"
            columns: ["consumption_order_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_order_effective"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "financial_transactions_consumption_order_fkey"
            columns: ["consumption_order_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_orders"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "financial_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_maintenance_cost_item_id_fkey"
            columns: ["maintenance_cost_item_id"]
            isOneToOne: false
            referencedRelation: "maintenance_cost_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_maintenance_recovery_id_fkey"
            columns: ["maintenance_recovery_id"]
            isOneToOne: false
            referencedRelation: "maintenance_recoveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_refund_hotel_fkey"
            columns: ["stay_refund_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "stay_refunds"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "financial_transactions_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_financial_transactions_hotel"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          address_complement: string | null
          address_line: string
          address_number: string
          checkin_time_limit: string | null
          checkin_time_start: string | null
          checkout_time_limit: string | null
          checkout_time_start: string | null
          city: string
          country: string
          created_at: string | null
          currency: string
          district: string
          email: string
          id: string
          is_active: boolean | null
          legal_name: string
          max_rooms: number | null
          max_users: number | null
          name: string
          phone: string
          slug: string
          state: string
          subscription_plan: string | null
          subscription_status: string | null
          tax_id: string
          timezone: string
          updated_at: string | null
          zip_code: string
        }
        Insert: {
          address_complement?: string | null
          address_line: string
          address_number: string
          checkin_time_limit?: string | null
          checkin_time_start?: string | null
          checkout_time_limit?: string | null
          checkout_time_start?: string | null
          city: string
          country: string
          created_at?: string | null
          currency: string
          district: string
          email: string
          id?: string
          is_active?: boolean | null
          legal_name: string
          max_rooms?: number | null
          max_users?: number | null
          name: string
          phone: string
          slug: string
          state: string
          subscription_plan?: string | null
          subscription_status?: string | null
          tax_id: string
          timezone: string
          updated_at?: string | null
          zip_code: string
        }
        Update: {
          address_complement?: string | null
          address_line?: string
          address_number?: string
          checkin_time_limit?: string | null
          checkin_time_start?: string | null
          checkout_time_limit?: string | null
          checkout_time_start?: string | null
          city?: string
          country?: string
          created_at?: string | null
          currency?: string
          district?: string
          email?: string
          id?: string
          is_active?: boolean | null
          legal_name?: string
          max_rooms?: number | null
          max_users?: number | null
          name?: string
          phone?: string
          slug?: string
          state?: string
          subscription_plan?: string | null
          subscription_status?: string | null
          tax_id?: string
          timezone?: string
          updated_at?: string | null
          zip_code?: string
        }
        Relationships: []
      }
      maintenance_attachments: {
        Row: {
          content_type: string
          created_at: string
          hotel_id: string
          id: string
          occurrence_id: string
          original_filename: string
          removal_reason: string | null
          removed_at: string | null
          removed_by: string | null
          size_bytes: number
          storage_path: string
          uploaded_by: string
          work_order_id: string | null
        }
        Insert: {
          content_type: string
          created_at?: string
          hotel_id: string
          id?: string
          occurrence_id: string
          original_filename: string
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          size_bytes: number
          storage_path: string
          uploaded_by: string
          work_order_id?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          hotel_id?: string
          id?: string
          occurrence_id?: string
          original_filename?: string
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_attachments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_attachments_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "maintenance_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_attachments_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_attachments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "maintenance_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_automation_runs: {
        Row: {
          counters: Json
          created_at: string
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          hotel_id: string | null
          id: string
          local_date: string | null
          run_key: string
          started_at: string
          status: Database["public"]["Enums"]["maintenance_automation_status"]
          trigger_kind: string
        }
        Insert: {
          counters?: Json
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          hotel_id?: string | null
          id?: string
          local_date?: string | null
          run_key: string
          started_at?: string
          status?: Database["public"]["Enums"]["maintenance_automation_status"]
          trigger_kind: string
        }
        Update: {
          counters?: Json
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          hotel_id?: string | null
          id?: string
          local_date?: string | null
          run_key?: string
          started_at?: string
          status?: Database["public"]["Enums"]["maintenance_automation_status"]
          trigger_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_automation_runs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          hotel_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          hotel_id: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          hotel_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_categories_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_checkout_acknowledgements: {
        Row: {
          acknowledged_at: string
          acknowledged_by: string
          hotel_id: string
          id: string
          note: string | null
          occurrence_id: string
          stay_id: string
        }
        Insert: {
          acknowledged_at?: string
          acknowledged_by: string
          hotel_id: string
          id?: string
          note?: string | null
          occurrence_id: string
          stay_id: string
        }
        Update: {
          acknowledged_at?: string
          acknowledged_by?: string
          hotel_id?: string
          id?: string
          note?: string | null
          occurrence_id?: string
          stay_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_checkout_acknowledgements_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_checkout_acknowledgements_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_checkout_acknowledgements_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "maintenance_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_checkout_acknowledgements_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_contract_categories: {
        Row: {
          category_id: string
          contract_id: string
          hotel_id: string
          id: string
          is_active: boolean
        }
        Insert: {
          category_id: string
          contract_id: string
          hotel_id: string
          id?: string
          is_active?: boolean
        }
        Update: {
          category_id?: string
          contract_id?: string
          hotel_id?: string
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_contract_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "maintenance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_contract_categories_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "maintenance_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_contract_categories_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_contract_locations: {
        Row: {
          contract_id: string
          hotel_id: string
          id: string
          is_active: boolean
          location_id: string
        }
        Insert: {
          contract_id: string
          hotel_id: string
          id?: string
          is_active?: boolean
          location_id: string
        }
        Update: {
          contract_id?: string
          hotel_id?: string
          id?: string
          is_active?: boolean
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_contract_locations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "maintenance_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_contract_locations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_contract_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "maintenance_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_contracts: {
        Row: {
          commercial_terms: string | null
          contract_amount: number | null
          contract_number: string
          created_at: string
          created_by: string
          currency: string | null
          ends_on: string | null
          hotel_id: string
          id: string
          kind: Database["public"]["Enums"]["maintenance_contract_kind"]
          renewal_notice_on: string | null
          resolution_hours: number | null
          response_hours: number | null
          scope_notes: string | null
          starts_on: string
          status: Database["public"]["Enums"]["maintenance_contract_status"]
          supplier_id: string
          terminated_at: string | null
          terminated_by: string | null
          termination_reason: string | null
          updated_at: string
        }
        Insert: {
          commercial_terms?: string | null
          contract_amount?: number | null
          contract_number: string
          created_at?: string
          created_by: string
          currency?: string | null
          ends_on?: string | null
          hotel_id: string
          id?: string
          kind?: Database["public"]["Enums"]["maintenance_contract_kind"]
          renewal_notice_on?: string | null
          resolution_hours?: number | null
          response_hours?: number | null
          scope_notes?: string | null
          starts_on: string
          status?: Database["public"]["Enums"]["maintenance_contract_status"]
          supplier_id: string
          terminated_at?: string | null
          terminated_by?: string | null
          termination_reason?: string | null
          updated_at?: string
        }
        Update: {
          commercial_terms?: string | null
          contract_amount?: number | null
          contract_number?: string
          created_at?: string
          created_by?: string
          currency?: string | null
          ends_on?: string | null
          hotel_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["maintenance_contract_kind"]
          renewal_notice_on?: string | null
          resolution_hours?: number | null
          response_hours?: number | null
          scope_notes?: string | null
          starts_on?: string
          status?: Database["public"]["Enums"]["maintenance_contract_status"]
          supplier_id?: string
          terminated_at?: string | null
          terminated_by?: string | null
          termination_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_contracts_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_contracts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "maintenance_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_contracts_terminated_by_fkey"
            columns: ["terminated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_cost_items: {
        Row: {
          actual_amount: number | null
          approval_status: Database["public"]["Enums"]["maintenance_finance_approval_status"]
          approved_at: string | null
          approved_by: string | null
          canceled_at: string | null
          canceled_by: string | null
          contract_id: string | null
          counterparty: string | null
          created_at: string
          created_by: string
          currency: string
          decision_reason: string | null
          description: string
          due_date: string | null
          estimated_amount: number | null
          hotel_id: string
          id: string
          kind: Database["public"]["Enums"]["maintenance_cost_kind"]
          occurrence_id: string
          quantity: number
          reference_code: string | null
          rejected_at: string | null
          rejected_by: string | null
          settlement_status: Database["public"]["Enums"]["maintenance_finance_settlement_status"]
          submitted_at: string | null
          supplier_id: string | null
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          actual_amount?: number | null
          approval_status?: Database["public"]["Enums"]["maintenance_finance_approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          contract_id?: string | null
          counterparty?: string | null
          created_at?: string
          created_by: string
          currency: string
          decision_reason?: string | null
          description: string
          due_date?: string | null
          estimated_amount?: number | null
          hotel_id: string
          id?: string
          kind: Database["public"]["Enums"]["maintenance_cost_kind"]
          occurrence_id: string
          quantity?: number
          reference_code?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          settlement_status?: Database["public"]["Enums"]["maintenance_finance_settlement_status"]
          submitted_at?: string | null
          supplier_id?: string | null
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          actual_amount?: number | null
          approval_status?: Database["public"]["Enums"]["maintenance_finance_approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          contract_id?: string | null
          counterparty?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          decision_reason?: string | null
          description?: string
          due_date?: string | null
          estimated_amount?: number | null
          hotel_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["maintenance_cost_kind"]
          occurrence_id?: string
          quantity?: number
          reference_code?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          settlement_status?: Database["public"]["Enums"]["maintenance_finance_settlement_status"]
          submitted_at?: string | null
          supplier_id?: string | null
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_cost_items_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_cost_items_canceled_by_fkey"
            columns: ["canceled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_cost_items_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "maintenance_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_cost_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_cost_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_cost_items_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "maintenance_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_cost_items_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_cost_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "maintenance_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_cost_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "maintenance_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          hotel_id: string
          id: string
          message: string | null
          metadata: Json
          occurrence_id: string
          work_order_id: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_type: string
          hotel_id: string
          id?: string
          message?: string | null
          metadata?: Json
          occurrence_id: string
          work_order_id?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          hotel_id?: string
          id?: string
          message?: string | null
          metadata?: Json
          occurrence_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_events_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_events_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "maintenance_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "maintenance_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_financial_attachments: {
        Row: {
          content_type: string
          cost_item_id: string | null
          created_at: string
          hotel_id: string
          id: string
          occurrence_id: string
          original_filename: string
          recovery_id: string | null
          removal_reason: string | null
          removed_at: string | null
          removed_by: string | null
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          content_type: string
          cost_item_id?: string | null
          created_at?: string
          hotel_id: string
          id?: string
          occurrence_id: string
          original_filename: string
          recovery_id?: string | null
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Update: {
          content_type?: string
          cost_item_id?: string | null
          created_at?: string
          hotel_id?: string
          id?: string
          occurrence_id?: string
          original_filename?: string
          recovery_id?: string | null
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_financial_attachments_cost_item_id_fkey"
            columns: ["cost_item_id"]
            isOneToOne: false
            referencedRelation: "maintenance_cost_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_financial_attachments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_financial_attachments_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "maintenance_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_financial_attachments_recovery_id_fkey"
            columns: ["recovery_id"]
            isOneToOne: false
            referencedRelation: "maintenance_recoveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_financial_attachments_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_financial_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_financial_checkout_acknowledgements: {
        Row: {
          acknowledged_at: string
          acknowledged_by: string
          folio_entry_id: string
          hotel_id: string
          id: string
          note: string | null
          stay_id: string
        }
        Insert: {
          acknowledged_at?: string
          acknowledged_by: string
          folio_entry_id: string
          hotel_id: string
          id?: string
          note?: string | null
          stay_id: string
        }
        Update: {
          acknowledged_at?: string
          acknowledged_by?: string
          folio_entry_id?: string
          hotel_id?: string
          id?: string
          note?: string | null
          stay_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_financial_checkout_acknowledge_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_financial_checkout_acknowledgem_folio_entry_id_fkey"
            columns: ["folio_entry_id"]
            isOneToOne: false
            referencedRelation: "stay_folio_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_financial_checkout_acknowledgements_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_financial_checkout_acknowledgements_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_financial_settlements: {
        Row: {
          amount: number
          cost_item_id: string | null
          created_at: string
          created_by: string
          financial_transaction_id: string
          hotel_id: string
          id: string
          recovery_id: string | null
          reversal_of_id: string | null
        }
        Insert: {
          amount: number
          cost_item_id?: string | null
          created_at?: string
          created_by: string
          financial_transaction_id: string
          hotel_id: string
          id?: string
          recovery_id?: string | null
          reversal_of_id?: string | null
        }
        Update: {
          amount?: number
          cost_item_id?: string | null
          created_at?: string
          created_by?: string
          financial_transaction_id?: string
          hotel_id?: string
          id?: string
          recovery_id?: string | null
          reversal_of_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_financial_settlements_cost_item_id_fkey"
            columns: ["cost_item_id"]
            isOneToOne: false
            referencedRelation: "maintenance_cost_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_financial_settlements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_financial_settlements_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: true
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_financial_settlements_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_financial_settlements_recovery_id_fkey"
            columns: ["recovery_id"]
            isOneToOne: false
            referencedRelation: "maintenance_recoveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_financial_settlements_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: true
            referencedRelation: "maintenance_financial_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_inspections: {
        Row: {
          created_at: string
          hotel_id: string
          id: string
          inspector_id: string
          notes: string
          result: Database["public"]["Enums"]["maintenance_inspection_result"]
          work_order_id: string
        }
        Insert: {
          created_at?: string
          hotel_id: string
          id?: string
          inspector_id: string
          notes: string
          result: Database["public"]["Enums"]["maintenance_inspection_result"]
          work_order_id: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          id?: string
          inspector_id?: string
          notes?: string
          result?: Database["public"]["Enums"]["maintenance_inspection_result"]
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_inspections_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_inspections_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "maintenance_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_locations: {
        Row: {
          asset_tag: string | null
          contract_id: string | null
          created_at: string
          description: string | null
          display_order: number
          hotel_id: string
          id: string
          installed_on: string | null
          is_active: boolean
          kind: Database["public"]["Enums"]["maintenance_location_kind"]
          lifecycle_status:
            | Database["public"]["Enums"]["maintenance_asset_lifecycle"]
            | null
          manufacturer: string | null
          model: string | null
          name: string
          parent_location_id: string | null
          serial_number: string | null
          supplier_id: string | null
          updated_at: string
          warranty_ends_on: string | null
        }
        Insert: {
          asset_tag?: string | null
          contract_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          hotel_id: string
          id?: string
          installed_on?: string | null
          is_active?: boolean
          kind: Database["public"]["Enums"]["maintenance_location_kind"]
          lifecycle_status?:
            | Database["public"]["Enums"]["maintenance_asset_lifecycle"]
            | null
          manufacturer?: string | null
          model?: string | null
          name: string
          parent_location_id?: string | null
          serial_number?: string | null
          supplier_id?: string | null
          updated_at?: string
          warranty_ends_on?: string | null
        }
        Update: {
          asset_tag?: string | null
          contract_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          hotel_id?: string
          id?: string
          installed_on?: string | null
          is_active?: boolean
          kind?: Database["public"]["Enums"]["maintenance_location_kind"]
          lifecycle_status?:
            | Database["public"]["Enums"]["maintenance_asset_lifecycle"]
            | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          parent_location_id?: string | null
          serial_number?: string | null
          supplier_id?: string | null
          updated_at?: string
          warranty_ends_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_locations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "maintenance_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_locations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_locations_parent_location_id_fkey"
            columns: ["parent_location_id"]
            isOneToOne: false
            referencedRelation: "maintenance_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_locations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "maintenance_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_management_attachments: {
        Row: {
          content_type: string
          contract_id: string | null
          created_at: string
          hotel_id: string
          id: string
          original_filename: string
          removal_reason: string | null
          removed_at: string | null
          removed_by: string | null
          size_bytes: number
          storage_path: string
          supplier_id: string | null
          uploaded_by: string
        }
        Insert: {
          content_type: string
          contract_id?: string | null
          created_at?: string
          hotel_id: string
          id?: string
          original_filename: string
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          size_bytes: number
          storage_path: string
          supplier_id?: string | null
          uploaded_by: string
        }
        Update: {
          content_type?: string
          contract_id?: string | null
          created_at?: string
          hotel_id?: string
          id?: string
          original_filename?: string
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          size_bytes?: number
          storage_path?: string
          supplier_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_management_attachments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "maintenance_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_management_attachments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_management_attachments_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_management_attachments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "maintenance_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_management_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_notifications: {
        Row: {
          created_at: string
          dismissed_at: string | null
          entity_id: string
          entity_type: string
          hotel_id: string
          href: string
          id: string
          kind: string
          message: string
          read_at: string | null
          recipient_id: string
          severity: string
          status: Database["public"]["Enums"]["maintenance_notification_status"]
          threshold: string
          title: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          entity_id: string
          entity_type: string
          hotel_id: string
          href: string
          id?: string
          kind: string
          message: string
          read_at?: string | null
          recipient_id: string
          severity?: string
          status?: Database["public"]["Enums"]["maintenance_notification_status"]
          threshold: string
          title: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          entity_id?: string
          entity_type?: string
          hotel_id?: string
          href?: string
          id?: string
          kind?: string
          message?: string
          read_at?: string | null
          recipient_id?: string
          severity?: string
          status?: Database["public"]["Enums"]["maintenance_notification_status"]
          threshold?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_notifications_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_occurrences: {
        Row: {
          blocking_recommended: boolean
          canceled_reason: string | null
          category_id: string
          confirmed_party:
            | Database["public"]["Enums"]["maintenance_responsible_party"]
            | null
          created_at: string
          description: string
          discovered_at: string
          duplicate_of_id: string | null
          hotel_id: string
          id: string
          kind: Database["public"]["Enums"]["maintenance_occurrence_kind"]
          liability_decided_at: string | null
          liability_decided_by: string | null
          liability_notes: string | null
          liability_status: Database["public"]["Enums"]["maintenance_liability_status"]
          location_id: string | null
          occurrence_number: number
          operational_resolved_at: string | null
          preventive_plan_id: string | null
          preventive_run_id: string | null
          priority: Database["public"]["Enums"]["maintenance_priority"]
          reported_by: string
          resolved_at: string | null
          room_id: string | null
          sla_policy_id: string | null
          sla_resolution_due_at: string | null
          sla_response_due_at: string | null
          sla_snapshot: Json | null
          status: Database["public"]["Enums"]["maintenance_occurrence_status"]
          stay_id: string | null
          suspected_party:
            | Database["public"]["Enums"]["maintenance_responsible_party"]
            | null
          triaged_at: string | null
          triaged_by: string | null
          updated_at: string
        }
        Insert: {
          blocking_recommended?: boolean
          canceled_reason?: string | null
          category_id: string
          confirmed_party?:
            | Database["public"]["Enums"]["maintenance_responsible_party"]
            | null
          created_at?: string
          description: string
          discovered_at?: string
          duplicate_of_id?: string | null
          hotel_id: string
          id?: string
          kind: Database["public"]["Enums"]["maintenance_occurrence_kind"]
          liability_decided_at?: string | null
          liability_decided_by?: string | null
          liability_notes?: string | null
          liability_status?: Database["public"]["Enums"]["maintenance_liability_status"]
          location_id?: string | null
          occurrence_number?: number
          operational_resolved_at?: string | null
          preventive_plan_id?: string | null
          preventive_run_id?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          reported_by: string
          resolved_at?: string | null
          room_id?: string | null
          sla_policy_id?: string | null
          sla_resolution_due_at?: string | null
          sla_response_due_at?: string | null
          sla_snapshot?: Json | null
          status?: Database["public"]["Enums"]["maintenance_occurrence_status"]
          stay_id?: string | null
          suspected_party?:
            | Database["public"]["Enums"]["maintenance_responsible_party"]
            | null
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
        }
        Update: {
          blocking_recommended?: boolean
          canceled_reason?: string | null
          category_id?: string
          confirmed_party?:
            | Database["public"]["Enums"]["maintenance_responsible_party"]
            | null
          created_at?: string
          description?: string
          discovered_at?: string
          duplicate_of_id?: string | null
          hotel_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["maintenance_occurrence_kind"]
          liability_decided_at?: string | null
          liability_decided_by?: string | null
          liability_notes?: string | null
          liability_status?: Database["public"]["Enums"]["maintenance_liability_status"]
          location_id?: string | null
          occurrence_number?: number
          operational_resolved_at?: string | null
          preventive_plan_id?: string | null
          preventive_run_id?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          reported_by?: string
          resolved_at?: string | null
          room_id?: string | null
          sla_policy_id?: string | null
          sla_resolution_due_at?: string | null
          sla_response_due_at?: string | null
          sla_snapshot?: Json | null
          status?: Database["public"]["Enums"]["maintenance_occurrence_status"]
          stay_id?: string | null
          suspected_party?:
            | Database["public"]["Enums"]["maintenance_responsible_party"]
            | null
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_occurrences_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "maintenance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_occurrences_duplicate_of_id_fkey"
            columns: ["duplicate_of_id"]
            isOneToOne: false
            referencedRelation: "maintenance_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_occurrences_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_occurrences_liability_decided_by_fkey"
            columns: ["liability_decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_occurrences_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "maintenance_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_occurrences_preventive_plan_id_fkey"
            columns: ["preventive_plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_preventive_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_occurrences_preventive_run_id_fkey"
            columns: ["preventive_run_id"]
            isOneToOne: false
            referencedRelation: "maintenance_preventive_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_occurrences_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_occurrences_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_occurrences_sla_policy_id_fkey"
            columns: ["sla_policy_id"]
            isOneToOne: false
            referencedRelation: "maintenance_sla_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_occurrences_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_occurrences_triaged_by_fkey"
            columns: ["triaged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_preventive_plan_tasks: {
        Row: {
          created_at: string
          description: string
          hotel_id: string
          id: string
          is_active: boolean
          is_required: boolean
          plan_id: string
          position: number
        }
        Insert: {
          created_at?: string
          description: string
          hotel_id: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          plan_id: string
          position: number
        }
        Update: {
          created_at?: string
          description?: string
          hotel_id?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          plan_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_preventive_plan_tasks_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_preventive_plan_tasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_preventive_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_preventive_plans: {
        Row: {
          assigned_to: string
          blocking_recommended: boolean
          category_id: string
          completion_due_hours: number
          contract_id: string | null
          created_at: string
          created_by: string
          deactivated_at: string | null
          deactivated_by: string | null
          ends_on: string | null
          generation_lead_days: number
          hotel_id: string
          id: string
          instructions: string
          local_time: string
          location_id: string | null
          name: string
          next_due_date: string
          paused_at: string | null
          paused_by: string | null
          priority: Database["public"]["Enums"]["maintenance_priority"]
          recurrence_day: number
          recurrence_interval: number
          recurrence_unit: Database["public"]["Enums"]["maintenance_recurrence_unit"]
          requires_inspection: boolean
          room_id: string | null
          starts_on: string
          status: Database["public"]["Enums"]["maintenance_preventive_plan_status"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to: string
          blocking_recommended?: boolean
          category_id: string
          completion_due_hours?: number
          contract_id?: string | null
          created_at?: string
          created_by: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          ends_on?: string | null
          generation_lead_days?: number
          hotel_id: string
          id?: string
          instructions: string
          local_time?: string
          location_id?: string | null
          name: string
          next_due_date: string
          paused_at?: string | null
          paused_by?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          recurrence_day: number
          recurrence_interval?: number
          recurrence_unit: Database["public"]["Enums"]["maintenance_recurrence_unit"]
          requires_inspection?: boolean
          room_id?: string | null
          starts_on: string
          status?: Database["public"]["Enums"]["maintenance_preventive_plan_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          blocking_recommended?: boolean
          category_id?: string
          completion_due_hours?: number
          contract_id?: string | null
          created_at?: string
          created_by?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          ends_on?: string | null
          generation_lead_days?: number
          hotel_id?: string
          id?: string
          instructions?: string
          local_time?: string
          location_id?: string | null
          name?: string
          next_due_date?: string
          paused_at?: string | null
          paused_by?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          recurrence_day?: number
          recurrence_interval?: number
          recurrence_unit?: Database["public"]["Enums"]["maintenance_recurrence_unit"]
          requires_inspection?: boolean
          room_id?: string | null
          starts_on?: string
          status?: Database["public"]["Enums"]["maintenance_preventive_plan_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_preventive_plans_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_preventive_plans_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "maintenance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_preventive_plans_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "maintenance_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_preventive_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_preventive_plans_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_preventive_plans_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_preventive_plans_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "maintenance_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_preventive_plans_paused_by_fkey"
            columns: ["paused_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_preventive_plans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_preventive_plans_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "maintenance_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_preventive_runs: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          hotel_id: string
          id: string
          occurrence_id: string | null
          plan_id: string
          rescheduled_for: string | null
          scheduled_for: string
          scheduled_local_date: string
          snapshot: Json
          status: Database["public"]["Enums"]["maintenance_preventive_run_status"]
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          hotel_id: string
          id?: string
          occurrence_id?: string | null
          plan_id: string
          rescheduled_for?: string | null
          scheduled_for: string
          scheduled_local_date: string
          snapshot: Json
          status?: Database["public"]["Enums"]["maintenance_preventive_run_status"]
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          hotel_id?: string
          id?: string
          occurrence_id?: string | null
          plan_id?: string
          rescheduled_for?: string | null
          scheduled_for?: string
          scheduled_local_date?: string
          snapshot?: Json
          status?: Database["public"]["Enums"]["maintenance_preventive_run_status"]
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_preventive_runs_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_preventive_runs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_preventive_runs_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "maintenance_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_preventive_runs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_preventive_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_preventive_runs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "maintenance_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_recoveries: {
        Row: {
          approval_status: Database["public"]["Enums"]["maintenance_finance_approval_status"]
          approved_at: string | null
          approved_by: string | null
          canceled_at: string | null
          canceled_by: string | null
          charge_amount: number
          contract_id: string | null
          created_at: string
          created_by: string
          currency: string
          debtor_name: string | null
          decision_reason: string | null
          due_date: string | null
          folio_entry_id: string | null
          hotel_id: string
          id: string
          justification: string
          occurrence_id: string
          rejected_at: string | null
          rejected_by: string | null
          responsible_party: Database["public"]["Enums"]["maintenance_responsible_party"]
          settlement_status: Database["public"]["Enums"]["maintenance_finance_settlement_status"]
          stay_id: string | null
          submitted_at: string | null
          supplier_id: string | null
          updated_at: string
          waived_amount: number
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["maintenance_finance_approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          charge_amount?: number
          contract_id?: string | null
          created_at?: string
          created_by: string
          currency: string
          debtor_name?: string | null
          decision_reason?: string | null
          due_date?: string | null
          folio_entry_id?: string | null
          hotel_id: string
          id?: string
          justification: string
          occurrence_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          responsible_party: Database["public"]["Enums"]["maintenance_responsible_party"]
          settlement_status?: Database["public"]["Enums"]["maintenance_finance_settlement_status"]
          stay_id?: string | null
          submitted_at?: string | null
          supplier_id?: string | null
          updated_at?: string
          waived_amount?: number
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["maintenance_finance_approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          charge_amount?: number
          contract_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          debtor_name?: string | null
          decision_reason?: string | null
          due_date?: string | null
          folio_entry_id?: string | null
          hotel_id?: string
          id?: string
          justification?: string
          occurrence_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          responsible_party?: Database["public"]["Enums"]["maintenance_responsible_party"]
          settlement_status?: Database["public"]["Enums"]["maintenance_finance_settlement_status"]
          stay_id?: string | null
          submitted_at?: string | null
          supplier_id?: string | null
          updated_at?: string
          waived_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_recoveries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_recoveries_canceled_by_fkey"
            columns: ["canceled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_recoveries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "maintenance_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_recoveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_recoveries_folio_entry_id_fkey"
            columns: ["folio_entry_id"]
            isOneToOne: false
            referencedRelation: "stay_folio_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_recoveries_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_recoveries_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "maintenance_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_recoveries_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_recoveries_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_recoveries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "maintenance_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_sla_policies: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          hotel_id: string
          id: string
          is_active: boolean
          name: string
          priority: Database["public"]["Enums"]["maintenance_priority"]
          resolution_hours: number
          response_hours: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          hotel_id: string
          id?: string
          is_active?: boolean
          name: string
          priority: Database["public"]["Enums"]["maintenance_priority"]
          resolution_hours: number
          response_hours: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          hotel_id?: string
          id?: string
          is_active?: boolean
          name?: string
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          resolution_hours?: number
          response_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_sla_policies_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "maintenance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_sla_policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_sla_policies_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_supplier_contacts: {
        Row: {
          created_at: string
          created_by: string
          email: string | null
          hotel_id: string
          id: string
          is_active: boolean
          is_primary: boolean
          name: string
          phone: string | null
          role: string | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email?: string | null
          hotel_id: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name: string
          phone?: string | null
          role?: string | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string | null
          hotel_id?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name?: string
          phone?: string | null
          role?: string | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_supplier_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_supplier_contacts_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "maintenance_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_suppliers: {
        Row: {
          created_at: string
          created_by: string
          email: string | null
          hotel_id: string
          id: string
          legal_name: string | null
          name: string
          notes: string | null
          phone: string | null
          specialties: string[]
          status: Database["public"]["Enums"]["maintenance_supplier_status"]
          tax_document: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email?: string | null
          hotel_id: string
          id?: string
          legal_name?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          specialties?: string[]
          status?: Database["public"]["Enums"]["maintenance_supplier_status"]
          tax_document?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string | null
          hotel_id?: string
          id?: string
          legal_name?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          specialties?: string[]
          status?: Database["public"]["Enums"]["maintenance_supplier_status"]
          tax_document?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_suppliers_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_work_order_checklist_items: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          completion_notes: string | null
          created_at: string
          description: string
          hotel_id: string
          id: string
          is_required: boolean
          position: number
          source_task_id: string | null
          work_order_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string
          description: string
          hotel_id: string
          id?: string
          is_required?: boolean
          position: number
          source_task_id?: string | null
          work_order_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string
          description?: string
          hotel_id?: string
          id?: string
          is_required?: boolean
          position?: number
          source_task_id?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_work_order_checklist_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_order_checklist_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_order_checklist_items_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_preventive_plan_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_order_checklist_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "maintenance_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_work_orders: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          contract_id: string | null
          created_at: string
          created_by: string
          diagnosis: string | null
          due_at: string | null
          hotel_id: string
          id: string
          instructions: string
          occurrence_id: string
          priority: Database["public"]["Enums"]["maintenance_priority"]
          requires_inspection: boolean
          resolution_notes: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["maintenance_work_order_status"]
          supplier_accepted_at: string | null
          supplier_completed_at: string | null
          supplier_external_reference: string | null
          supplier_id: string | null
          supplier_sent_at: string | null
          supplier_status: Database["public"]["Enums"]["maintenance_supplier_work_status"]
          title: string
          updated_at: string
          waiting_notes: string | null
          waiting_reason:
            | Database["public"]["Enums"]["maintenance_waiting_reason"]
            | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by: string
          diagnosis?: string | null
          due_at?: string | null
          hotel_id: string
          id?: string
          instructions: string
          occurrence_id: string
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          requires_inspection?: boolean
          resolution_notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["maintenance_work_order_status"]
          supplier_accepted_at?: string | null
          supplier_completed_at?: string | null
          supplier_external_reference?: string | null
          supplier_id?: string | null
          supplier_sent_at?: string | null
          supplier_status?: Database["public"]["Enums"]["maintenance_supplier_work_status"]
          title: string
          updated_at?: string
          waiting_notes?: string | null
          waiting_reason?:
            | Database["public"]["Enums"]["maintenance_waiting_reason"]
            | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string
          diagnosis?: string | null
          due_at?: string | null
          hotel_id?: string
          id?: string
          instructions?: string
          occurrence_id?: string
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          requires_inspection?: boolean
          resolution_notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["maintenance_work_order_status"]
          supplier_accepted_at?: string | null
          supplier_completed_at?: string | null
          supplier_external_reference?: string | null
          supplier_id?: string | null
          supplier_sent_at?: string | null
          supplier_status?: Database["public"]["Enums"]["maintenance_supplier_work_status"]
          title?: string
          updated_at?: string
          waiting_notes?: string | null
          waiting_reason?:
            | Database["public"]["Enums"]["maintenance_waiting_reason"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_work_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_orders_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "maintenance_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_orders_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_orders_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "maintenance_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "maintenance_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          id: string
          name: string
          type: string
        }
        Insert: {
          id?: string
          name: string
          type: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          archived_at: string | null
          created_at: string
          display_order: number
          hotel_id: string
          id: string
          is_active: boolean
          last_changed_by: string | null
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          display_order?: number
          hotel_id: string
          id?: string
          is_active?: boolean
          last_changed_by?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          display_order?: number
          hotel_id?: string
          id?: string
          is_active?: boolean
          last_changed_by?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_last_changed_by_fkey"
            columns: ["last_changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          archived_at: string | null
          category_id: string
          commercial_partner_id: string | null
          created_at: string
          description: string | null
          hotel_id: string
          id: string
          internal_code: string | null
          kind: Database["public"]["Enums"]["product_kind"]
          last_changed_by: string | null
          name: string
          provider_type: Database["public"]["Enums"]["product_provider_type"]
          sales_unit: Database["public"]["Enums"]["product_sales_unit"]
          status: Database["public"]["Enums"]["product_status"]
          unit_price: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category_id: string
          commercial_partner_id?: string | null
          created_at?: string
          description?: string | null
          hotel_id: string
          id?: string
          internal_code?: string | null
          kind?: Database["public"]["Enums"]["product_kind"]
          last_changed_by?: string | null
          name: string
          provider_type?: Database["public"]["Enums"]["product_provider_type"]
          sales_unit?: Database["public"]["Enums"]["product_sales_unit"]
          status?: Database["public"]["Enums"]["product_status"]
          unit_price: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category_id?: string
          commercial_partner_id?: string | null
          created_at?: string
          description?: string | null
          hotel_id?: string
          id?: string
          internal_code?: string | null
          kind?: Database["public"]["Enums"]["product_kind"]
          last_changed_by?: string | null
          name?: string
          provider_type?: Database["public"]["Enums"]["product_provider_type"]
          sales_unit?: Database["public"]["Enums"]["product_sales_unit"]
          status?: Database["public"]["Enums"]["product_status"]
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_hotel_fkey"
            columns: ["category_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "products_commercial_partner_hotel_fkey"
            columns: ["commercial_partner_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "commercial_partners"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "products_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_last_changed_by_fkey"
            columns: ["last_changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          booking_customer_id: string
          created_at: string
          estimated_total_price: number | null
          final_total_price: number | null
          guest_count: number
          hotel_id: string
          id: string
          notes: string | null
          reservation_code: string
          reservation_source:
            | Database["public"]["Enums"]["reservation_source"]
            | null
          total_paid: number
          updated_at: string
        }
        Insert: {
          booking_customer_id: string
          created_at?: string
          estimated_total_price?: number | null
          final_total_price?: number | null
          guest_count: number
          hotel_id: string
          id?: string
          notes?: string | null
          reservation_code: string
          reservation_source?:
            | Database["public"]["Enums"]["reservation_source"]
            | null
          total_paid?: number
          updated_at?: string
        }
        Update: {
          booking_customer_id?: string
          created_at?: string
          estimated_total_price?: number | null
          final_total_price?: number | null
          guest_count?: number
          hotel_id?: string
          id?: string
          notes?: string | null
          reservation_code?: string
          reservation_source?:
            | Database["public"]["Enums"]["reservation_source"]
            | null
          total_paid?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_booking_customer_id_fkey"
            columns: ["booking_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          hotel_id: string | null
          id: string
          name: string
          role_type: string
        }
        Insert: {
          hotel_id?: string | null
          id?: string
          name: string
          role_type: string
        }
        Update: {
          hotel_id?: string | null
          id?: string
          name?: string
          role_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      room_blocks: {
        Row: {
          conflicts_acknowledged_at: string | null
          conflicts_acknowledged_by: string | null
          conflicts_acknowledgement: string | null
          created_at: string
          created_by: string | null
          end_date: string
          hotel_id: string
          id: string
          label: string | null
          maintenance_occurrence_id: string | null
          release_reason: string | null
          released_at: string | null
          released_by: string | null
          room_id: string
          start_date: string
          status: Database["public"]["Enums"]["room_block_status"]
          updated_at: string
        }
        Insert: {
          conflicts_acknowledged_at?: string | null
          conflicts_acknowledged_by?: string | null
          conflicts_acknowledgement?: string | null
          created_at?: string
          created_by?: string | null
          end_date: string
          hotel_id: string
          id?: string
          label?: string | null
          maintenance_occurrence_id?: string | null
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          room_id: string
          start_date: string
          status?: Database["public"]["Enums"]["room_block_status"]
          updated_at?: string
        }
        Update: {
          conflicts_acknowledged_at?: string | null
          conflicts_acknowledged_by?: string | null
          conflicts_acknowledgement?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string
          hotel_id?: string
          id?: string
          label?: string | null
          maintenance_occurrence_id?: string | null
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          room_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["room_block_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_blocks_conflicts_acknowledged_by_fkey"
            columns: ["conflicts_acknowledged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_blocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_blocks_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_blocks_maintenance_occurrence_id_fkey"
            columns: ["maintenance_occurrence_id"]
            isOneToOne: false
            referencedRelation: "maintenance_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_blocks_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_blocks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          base_daily_rate: number
          created_at: string
          hotel_id: string
          id: string
          max_occupancy: number
          notes: string | null
          room_number: string
          room_type: string
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string
        }
        Insert: {
          base_daily_rate: number
          created_at?: string
          hotel_id: string
          id?: string
          max_occupancy: number
          notes?: string | null
          room_number: string
          room_type: string
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Update: {
          base_daily_rate?: number
          created_at?: string
          hotel_id?: string
          id?: string
          max_occupancy?: number
          notes?: string | null
          room_number?: string
          room_type?: string
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      season_room_rates: {
        Row: {
          created_at: string
          daily_rate: number
          hotel_id: string
          id: string
          room_type: string
          season_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_rate: number
          hotel_id: string
          id?: string
          room_type: string
          season_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_rate?: number
          hotel_id?: string
          id?: string
          room_type?: string
          season_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_room_rates_season_id_hotel_id_fkey"
            columns: ["season_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id", "hotel_id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          end_date: string
          hotel_id: string
          id: string
          is_active: boolean
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          hotel_id: string
          id?: string
          is_active?: boolean
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          hotel_id?: string
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      stay_account_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          hotel_id: string
          id: string
          stay_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          hotel_id: string
          id?: string
          stay_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          hotel_id?: string
          id?: string
          stay_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stay_account_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_account_events_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_account_events_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      stay_checkout_records: {
        Row: {
          account_version: number
          checked_out_at: string
          checked_out_by: string | null
          consumption_total: number
          courtesy_total: number
          created_at: string
          currency: string
          discount_total: number
          exception_folio_entry_ids: string[]
          hotel_id: string
          id: string
          idempotency_key: string | null
          kind: Database["public"]["Enums"]["stay_checkout_record_kind"]
          lodging_total: number
          maintenance_total: number
          partner_direct_total: number
          payment_total: number
          request_fingerprint: string | null
          reservation_id: string
          statement_snapshot: Json
          stay_id: string
          voided_total: number
        }
        Insert: {
          account_version: number
          checked_out_at: string
          checked_out_by?: string | null
          consumption_total?: number
          courtesy_total?: number
          created_at?: string
          currency: string
          discount_total?: number
          exception_folio_entry_ids?: string[]
          hotel_id: string
          id?: string
          idempotency_key?: string | null
          kind: Database["public"]["Enums"]["stay_checkout_record_kind"]
          lodging_total?: number
          maintenance_total?: number
          partner_direct_total?: number
          payment_total?: number
          request_fingerprint?: string | null
          reservation_id: string
          statement_snapshot: Json
          stay_id: string
          voided_total?: number
        }
        Update: {
          account_version?: number
          checked_out_at?: string
          checked_out_by?: string | null
          consumption_total?: number
          courtesy_total?: number
          created_at?: string
          currency?: string
          discount_total?: number
          exception_folio_entry_ids?: string[]
          hotel_id?: string
          id?: string
          idempotency_key?: string | null
          kind?: Database["public"]["Enums"]["stay_checkout_record_kind"]
          lodging_total?: number
          maintenance_total?: number
          partner_direct_total?: number
          payment_total?: number
          request_fingerprint?: string | null
          reservation_id?: string
          statement_snapshot?: Json
          stay_id?: string
          voided_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "stay_checkout_records_checked_out_by_fkey"
            columns: ["checked_out_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_checkout_records_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_checkout_records_reservation_hotel_fkey"
            columns: ["reservation_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "stay_checkout_records_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_checkout_records_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: true
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_checkout_records_stay_reservation_fkey"
            columns: ["stay_id", "reservation_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id", "reservation_id"]
          },
        ]
      }
      stay_customers: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          stay_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          stay_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          stay_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_customers_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      stay_folio_allocations: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          credit_entry_id: string
          debit_entry_id: string
          hotel_id: string
          id: string
          stay_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          credit_entry_id: string
          debit_entry_id: string
          hotel_id: string
          id?: string
          stay_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          credit_entry_id?: string
          debit_entry_id?: string
          hotel_id?: string
          id?: string
          stay_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stay_folio_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_folio_allocations_credit_entry_id_fkey"
            columns: ["credit_entry_id"]
            isOneToOne: false
            referencedRelation: "stay_folio_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_folio_allocations_debit_entry_id_fkey"
            columns: ["debit_entry_id"]
            isOneToOne: false
            referencedRelation: "stay_folio_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_folio_allocations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_folio_allocations_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      stay_folio_entries: {
        Row: {
          amount: number
          consumption_correction_id: string | null
          consumption_order_id: string | null
          created_at: string
          currency: string
          description: string
          direction: Database["public"]["Enums"]["stay_folio_direction"]
          financial_transaction_id: string | null
          hotel_id: string
          id: string
          kind: Database["public"]["Enums"]["stay_folio_kind"]
          maintenance_occurrence_id: string | null
          posted_at: string
          posted_by: string | null
          reservation_id: string
          reversed_entry_id: string | null
          source_key: string
          stay_id: string
        }
        Insert: {
          amount: number
          consumption_correction_id?: string | null
          consumption_order_id?: string | null
          created_at?: string
          currency: string
          description: string
          direction: Database["public"]["Enums"]["stay_folio_direction"]
          financial_transaction_id?: string | null
          hotel_id: string
          id?: string
          kind: Database["public"]["Enums"]["stay_folio_kind"]
          maintenance_occurrence_id?: string | null
          posted_at?: string
          posted_by?: string | null
          reservation_id: string
          reversed_entry_id?: string | null
          source_key: string
          stay_id: string
        }
        Update: {
          amount?: number
          consumption_correction_id?: string | null
          consumption_order_id?: string | null
          created_at?: string
          currency?: string
          description?: string
          direction?: Database["public"]["Enums"]["stay_folio_direction"]
          financial_transaction_id?: string | null
          hotel_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["stay_folio_kind"]
          maintenance_occurrence_id?: string | null
          posted_at?: string
          posted_by?: string | null
          reservation_id?: string
          reversed_entry_id?: string | null
          source_key?: string
          stay_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stay_folio_entries_consumption_order_fkey"
            columns: ["consumption_order_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_order_effective"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "stay_folio_entries_consumption_order_fkey"
            columns: ["consumption_order_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_orders"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "stay_folio_entries_correction_hotel_fkey"
            columns: ["consumption_correction_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_corrections"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "stay_folio_entries_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: true
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_folio_entries_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_folio_entries_maintenance_occurrence_id_fkey"
            columns: ["maintenance_occurrence_id"]
            isOneToOne: false
            referencedRelation: "maintenance_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_folio_entries_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_folio_entries_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_folio_entries_reversed_entry_id_fkey"
            columns: ["reversed_entry_id"]
            isOneToOne: false
            referencedRelation: "stay_folio_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_folio_entries_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      stay_payment_batch_tenders: {
        Row: {
          amount: number
          batch_id: string
          created_at: string
          display_order: number
          financial_transaction_id: string
          folio_credit_entry_id: string
          hotel_id: string
          id: string
          payment_method: Database["public"]["Enums"]["consumption_payment_method"]
          reference_code: string | null
        }
        Insert: {
          amount: number
          batch_id: string
          created_at?: string
          display_order: number
          financial_transaction_id: string
          folio_credit_entry_id: string
          hotel_id: string
          id?: string
          payment_method: Database["public"]["Enums"]["consumption_payment_method"]
          reference_code?: string | null
        }
        Update: {
          amount?: number
          batch_id?: string
          created_at?: string
          display_order?: number
          financial_transaction_id?: string
          folio_credit_entry_id?: string
          hotel_id?: string
          id?: string
          payment_method?: Database["public"]["Enums"]["consumption_payment_method"]
          reference_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stay_payment_batch_tenders_batch_hotel_fkey"
            columns: ["batch_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "stay_payment_batches"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "stay_payment_batch_tenders_folio_hotel_fkey"
            columns: ["folio_credit_entry_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "stay_folio_entries"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "stay_payment_batch_tenders_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_payment_batch_tenders_transaction_hotel_fkey"
            columns: ["financial_transaction_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id", "hotel_id"]
          },
        ]
      }
      stay_payment_batches: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          hotel_id: string
          id: string
          idempotency_key: string | null
          kind: Database["public"]["Enums"]["stay_payment_batch_kind"]
          note: string | null
          request_fingerprint: string | null
          reservation_id: string
          stay_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency: string
          hotel_id: string
          id?: string
          idempotency_key?: string | null
          kind?: Database["public"]["Enums"]["stay_payment_batch_kind"]
          note?: string | null
          request_fingerprint?: string | null
          reservation_id: string
          stay_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          hotel_id?: string
          id?: string
          idempotency_key?: string | null
          kind?: Database["public"]["Enums"]["stay_payment_batch_kind"]
          note?: string | null
          request_fingerprint?: string | null
          reservation_id?: string
          stay_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stay_payment_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_payment_batches_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_payment_batches_reservation_hotel_fkey"
            columns: ["reservation_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "stay_payment_batches_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_payment_batches_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_payment_batches_stay_reservation_fkey"
            columns: ["stay_id", "reservation_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id", "reservation_id"]
          },
        ]
      }
      stay_refunds: {
        Row: {
          amount: number
          correction_id: string | null
          created_at: string
          created_by: string
          currency: string
          financial_transaction_id: string
          folio_debit_entry_id: string
          hotel_id: string
          id: string
          idempotency_key: string
          method_override_reason: string | null
          original_payment_method:
            | Database["public"]["Enums"]["consumption_payment_method"]
            | null
          original_tender_id: string | null
          payment_method: Database["public"]["Enums"]["consumption_payment_method"]
          reason: string
          reference_code: string | null
          request_fingerprint: string
          reservation_id: string
          stay_id: string
        }
        Insert: {
          amount: number
          correction_id?: string | null
          created_at?: string
          created_by: string
          currency: string
          financial_transaction_id: string
          folio_debit_entry_id: string
          hotel_id: string
          id?: string
          idempotency_key: string
          method_override_reason?: string | null
          original_payment_method?:
            | Database["public"]["Enums"]["consumption_payment_method"]
            | null
          original_tender_id?: string | null
          payment_method: Database["public"]["Enums"]["consumption_payment_method"]
          reason: string
          reference_code?: string | null
          request_fingerprint: string
          reservation_id: string
          stay_id: string
        }
        Update: {
          amount?: number
          correction_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          financial_transaction_id?: string
          folio_debit_entry_id?: string
          hotel_id?: string
          id?: string
          idempotency_key?: string
          method_override_reason?: string | null
          original_payment_method?:
            | Database["public"]["Enums"]["consumption_payment_method"]
            | null
          original_tender_id?: string | null
          payment_method?: Database["public"]["Enums"]["consumption_payment_method"]
          reason?: string
          reference_code?: string | null
          request_fingerprint?: string
          reservation_id?: string
          stay_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stay_refunds_correction_hotel_fkey"
            columns: ["correction_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_corrections"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "stay_refunds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_refunds_folio_hotel_fkey"
            columns: ["folio_debit_entry_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "stay_folio_entries"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "stay_refunds_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_refunds_original_tender_id_fkey"
            columns: ["original_tender_id"]
            isOneToOne: false
            referencedRelation: "stay_payment_batch_tenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_refunds_reservation_hotel_fkey"
            columns: ["reservation_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "stay_refunds_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_refunds_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_refunds_stay_reservation_fkey"
            columns: ["stay_id", "reservation_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id", "reservation_id"]
          },
          {
            foreignKeyName: "stay_refunds_transaction_hotel_fkey"
            columns: ["financial_transaction_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id", "hotel_id"]
          },
        ]
      }
      stays: {
        Row: {
          account_version: number
          applied_daily_rate: number
          checkin_date_actual: string | null
          checkin_date_expected: string
          checkout_date_actual: string | null
          checkout_date_expected: string
          created_at: string
          id: string
          reservation_id: string
          room_id: string
          stay_status: Database["public"]["Enums"]["stay_status"]
          total_paid: number | null
          total_price_estimated: number
          updated_at: string
        }
        Insert: {
          account_version?: number
          applied_daily_rate: number
          checkin_date_actual?: string | null
          checkin_date_expected: string
          checkout_date_actual?: string | null
          checkout_date_expected: string
          created_at?: string
          id?: string
          reservation_id: string
          room_id: string
          stay_status?: Database["public"]["Enums"]["stay_status"]
          total_paid?: number | null
          total_price_estimated?: number
          updated_at?: string
        }
        Update: {
          account_version?: number
          applied_daily_rate?: number
          checkin_date_actual?: string | null
          checkin_date_expected?: string
          checkout_date_actual?: string | null
          checkout_date_expected?: string
          created_at?: string
          id?: string
          reservation_id?: string
          room_id?: string
          stay_status?: Database["public"]["Enums"]["stay_status"]
          total_paid?: number | null
          total_price_estimated?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_rooms_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_rooms_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          hotel_id: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          hotel_id?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          hotel_id?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          failed_attempts: number | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          locked_until: string | null
          name: string
          password_hash: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          failed_attempts?: number | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          locked_until?: string | null
          name: string
          password_hash: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          failed_attempts?: number | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          locked_until?: string | null
          name?: string
          password_hash?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      consumption_order_effective: {
        Row: {
          billing_mode:
            | Database["public"]["Enums"]["consumption_billing_mode"]
            | null
          disposition:
            | Database["public"]["Enums"]["consumption_order_disposition"]
            | null
          effective_discount_amount: number | null
          effective_gross_amount: number | null
          effective_net_amount: number | null
          effective_status: string | null
          hotel_id: string | null
          id: string | null
          original_discount_amount: number | null
          original_gross_amount: number | null
          original_net_amount: number | null
          stay_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumption_orders_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_orders_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      consumption_order_item_effective: {
        Row: {
          agreement_number_snapshot: string | null
          billing_policy_snapshot: Json | null
          category_id: string | null
          category_name_snapshot: string | null
          charged_unit_price: number | null
          commercial_agreement_id: string | null
          commercial_partner_id: string | null
          commercial_revision_id: string | null
          commercial_revision_version_snapshot: number | null
          commercial_terms_snapshot: Json | null
          created_at: string | null
          discount_amount: number | null
          effective_discount: number | null
          effective_net_amount: number | null
          effective_quantity: number | null
          hotel_id: string | null
          id: string | null
          item_total_amount: number | null
          net_amount: number | null
          notes: string | null
          offer_id: string | null
          order_id: string | null
          partner_name_snapshot: string | null
          product_id: string | null
          product_internal_code_snapshot: string | null
          product_kind_snapshot:
            | Database["public"]["Enums"]["product_kind"]
            | null
          product_name_snapshot: string | null
          provider_type_snapshot:
            | Database["public"]["Enums"]["product_provider_type"]
            | null
          quantity: number | null
          sales_unit_snapshot:
            | Database["public"]["Enums"]["product_sales_unit"]
            | null
          version_token: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumption_order_items_agreement_hotel_fkey"
            columns: ["commercial_agreement_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "commercial_agreements"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_order_items_category_hotel_fkey"
            columns: ["category_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_order_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_order_items_offer_hotel_fkey"
            columns: ["offer_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_offers"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_order_items_order_hotel_fkey"
            columns: ["order_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_order_effective"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_order_items_order_hotel_fkey"
            columns: ["order_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "consumption_orders"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_order_items_partner_hotel_fkey"
            columns: ["commercial_partner_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "commercial_partners"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_order_items_product_hotel_fkey"
            columns: ["product_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "hotel_id"]
          },
          {
            foreignKeyName: "consumption_order_items_revision_hotel_fkey"
            columns: ["commercial_revision_id", "hotel_id"]
            isOneToOne: false
            referencedRelation: "commercial_agreement_revisions"
            referencedColumns: ["id", "hotel_id"]
          },
        ]
      }
    }
    Functions: {
      activate_commercial_agreement_revision: {
        Args: { p_actor_id: string; p_hotel_id: string; p_revision_id: string }
        Returns: string
      }
      allocate_stay_account_credit: {
        Args: {
          p_actor_id: string
          p_credit_entry_id: string
          p_hotel_id: string
          p_stay_id: string
        }
        Returns: number
      }
      allocate_stay_folio_credit: {
        Args: {
          p_actor_id: string
          p_allocations?: Json
          p_credit_entry_id: string
          p_hotel_id: string
          p_stay_id: string
        }
        Returns: number
      }
      apply_maintenance_occurrence_change: {
        Args: {
          p_actor_id: string
          p_event_type: string
          p_hotel_id: string
          p_message?: string
          p_occurrence_id: string
          p_patch: Json
        }
        Returns: boolean
      }
      backfill_stay_folio: { Args: never; Returns: undefined }
      checkout_stay_account: {
        Args: {
          p_actor_id: string
          p_expected_version: number
          p_hotel_id: string
          p_idempotency_key: string
          p_maintenance_folio_entry_ids?: string[]
          p_note?: string
          p_occurrence_ids?: string[]
          p_stay_id: string
          p_tenders: Json
        }
        Returns: Json
      }
      checkout_stay_with_financial_acknowledgements: {
        Args: {
          p_actor_id: string
          p_folio_entry_ids?: string[]
          p_hotel_id: string
          p_note?: string
          p_occurrence_ids?: string[]
          p_stay_id: string
        }
        Returns: boolean
      }
      checkout_stay_with_maintenance_acknowledgements: {
        Args: {
          p_actor_id: string
          p_hotel_id: string
          p_note?: string
          p_occurrence_ids?: string[]
          p_stay_id: string
        }
        Returns: boolean
      }
      complete_maintenance_checklist_item: {
        Args: {
          p_actor_id: string
          p_completed: boolean
          p_hotel_id: string
          p_item_id: string
          p_notes?: string
          p_work_order_id: string
        }
        Returns: string
      }
      complete_partner_correction_refund: {
        Args: {
          p_actor_id: string
          p_correction_id: string
          p_hotel_id: string
          p_reference?: string
        }
        Returns: Json
      }
      create_commercial_agreement: {
        Args: {
          p_actor_id: string
          p_commercial_model: Database["public"]["Enums"]["commercial_model"]
          p_commission_percentage: number
          p_ends_on: string
          p_fixed_rent: number
          p_hotel_id: string
          p_internal_number: string
          p_minimum_guarantee: number
          p_notes: string
          p_partner_id: string
          p_payment_recipient: Database["public"]["Enums"]["commercial_payment_recipient"]
          p_point_ids: string[]
          p_rent_frequency: Database["public"]["Enums"]["commercial_rent_frequency"]
          p_starts_on: string
        }
        Returns: string
      }
      create_commercial_agreement_revision: {
        Args: {
          p_actor_id: string
          p_agreement_id: string
          p_commercial_model: Database["public"]["Enums"]["commercial_model"]
          p_commission_percentage: number
          p_ends_on: string
          p_fixed_rent: number
          p_hotel_id: string
          p_minimum_guarantee: number
          p_notes: string
          p_payment_recipient: Database["public"]["Enums"]["commercial_payment_recipient"]
          p_point_ids: string[]
          p_rent_frequency: Database["public"]["Enums"]["commercial_rent_frequency"]
          p_starts_on: string
        }
        Returns: string
      }
      create_default_maintenance_categories: {
        Args: { p_hotel_id: string }
        Returns: undefined
      }
      create_default_maintenance_sla_policies: {
        Args: { p_hotel_id: string }
        Returns: undefined
      }
      create_maintenance_occurrence: {
        Args: {
          p_blocking_recommended?: boolean
          p_category_id: string
          p_description?: string
          p_discovered_at?: string
          p_hotel_id: string
          p_kind?: Database["public"]["Enums"]["maintenance_occurrence_kind"]
          p_location_id?: string
          p_priority?: Database["public"]["Enums"]["maintenance_priority"]
          p_reported_by?: string
          p_room_id?: string
          p_stay_id?: string
        }
        Returns: string
      }
      create_maintenance_room_block: {
        Args: {
          p_actor_id: string
          p_conflict_acknowledgement?: string
          p_end_date: string
          p_hotel_id: string
          p_label?: string
          p_occurrence_id: string
          p_start_date: string
          p_status: Database["public"]["Enums"]["room_block_status"]
        }
        Returns: string
      }
      create_maintenance_work_order: {
        Args: {
          p_actor_id: string
          p_assigned_to?: string
          p_due_at?: string
          p_hotel_id: string
          p_instructions: string
          p_occurrence_id: string
          p_priority: Database["public"]["Enums"]["maintenance_priority"]
          p_requires_inspection?: boolean
          p_title: string
        }
        Returns: string
      }
      create_role_with_permissions:
        | {
            Args: {
              p_hotel_id: string
              p_name: string
              p_permission_ids: string[]
            }
            Returns: {
              id: string
              result: string
            }[]
          }
        | {
            Args: {
              p_hotel_id: string
              p_name: string
              p_permission_ids: string[]
              p_role_type: string
            }
            Returns: {
              id: string
              result: string
            }[]
          }
      create_stay_folio_payment: {
        Args: {
          p_actor_id: string
          p_allocations?: Json
          p_amount: number
          p_hotel_id: string
          p_maintenance_recovery_id?: string
          p_method: string
          p_note?: string
          p_paid_at?: string
          p_stay_id: string
        }
        Returns: string
      }
      create_stay_payment_batch: {
        Args: {
          p_actor_id: string
          p_expected_version: number
          p_hotel_id: string
          p_idempotency_key: string
          p_kind?: Database["public"]["Enums"]["stay_payment_batch_kind"]
          p_note?: string
          p_stay_id: string
          p_tenders: Json
        }
        Returns: Json
      }
      create_stay_refund: {
        Args: {
          p_actor_id: string
          p_amount: number
          p_correction_id?: string
          p_expected_version: number
          p_hotel_id: string
          p_idempotency_key: string
          p_method_override_reason?: string
          p_original_tender_id?: string
          p_payment_method: Database["public"]["Enums"]["consumption_payment_method"]
          p_reason: string
          p_reference?: string
          p_stay_id: string
        }
        Returns: Json
      }
      create_user_with_roles:
        | {
            Args: {
              p_email: string
              p_is_active: boolean
              p_name: string
              p_password_hash: string
              p_role_assignments: Database["public"]["CompositeTypes"]["admin_role_assignment_input"][]
            }
            Returns: {
              id: string
              result: string
            }[]
          }
        | {
            Args: {
              p_email: string
              p_is_active: boolean
              p_name: string
              p_password_hash: string
              p_role_ids: string[]
            }
            Returns: {
              id: string
              result: string
            }[]
          }
      decide_consumption_correction: {
        Args: {
          p_actor_id: string
          p_correction_id: string
          p_decision: string
          p_hotel_id: string
          p_reason?: string
        }
        Returns: Json
      }
      decide_maintenance_preventive_run: {
        Args: {
          p_action: string
          p_actor_id: string
          p_hotel_id: string
          p_reason: string
          p_rescheduled_for?: string
          p_run_id: string
        }
        Returns: string
      }
      generate_maintenance_preventive_run: {
        Args: {
          p_actor_id: string
          p_force?: boolean
          p_hotel_id: string
          p_reason?: string
          p_run_id: string
        }
        Returns: string
      }
      get_consumption_operational_context: {
        Args: { p_hotel_id: string; p_occurred_at?: string; p_stay_id: string }
        Returns: Json
      }
      inspect_maintenance_work_order: {
        Args: {
          p_actor_id: string
          p_hotel_id: string
          p_notes: string
          p_result: Database["public"]["Enums"]["maintenance_inspection_result"]
          p_work_order_id: string
        }
        Returns: string
      }
      maintenance_user_has_hotel_scope: {
        Args: { p_hotel_id: string; p_user_id: string }
        Returns: boolean
      }
      mark_all_maintenance_notifications_read: {
        Args: { p_hotel_id: string; p_recipient_id: string }
        Returns: number
      }
      next_maintenance_preventive_date: {
        Args: {
          p_current: string
          p_interval: number
          p_recurrence_day: number
          p_unit: Database["public"]["Enums"]["maintenance_recurrence_unit"]
        }
        Returns: string
      }
      notify_maintenance_managers: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_hotel_id: string
          p_href: string
          p_kind: string
          p_message: string
          p_severity: string
          p_threshold: string
          p_title: string
        }
        Returns: number
      }
      notify_maintenance_recipient: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_hotel_id: string
          p_href: string
          p_kind: string
          p_message: string
          p_recipient_id: string
          p_severity: string
          p_threshold: string
          p_title: string
        }
        Returns: boolean
      }
      post_consumption_order: {
        Args: {
          p_actor_id: string
          p_billing_mode: Database["public"]["Enums"]["consumption_billing_mode"]
          p_courtesy_reason?: string
          p_disposition: Database["public"]["Enums"]["consumption_order_disposition"]
          p_guest_customer_id?: string
          p_hotel_id: string
          p_idempotency_key: string
          p_items: Json
          p_notes?: string
          p_occurred_at: string
          p_partner_receipt_confirmed?: boolean
          p_payment_method?: Database["public"]["Enums"]["consumption_payment_method"]
          p_payment_reference?: string
          p_point_id: string
          p_stay_id: string
        }
        Returns: Json
      }
      process_maintenance_expiry_alerts: {
        Args: { p_hotel_id: string; p_local_date: string }
        Returns: number
      }
      process_maintenance_management_cycle: {
        Args: { p_force?: boolean; p_hotel_id?: string; p_now?: string }
        Returns: Json
      }
      process_maintenance_preventive_plans: {
        Args: { p_hotel_id: string; p_now?: string }
        Returns: Json
      }
      process_maintenance_sla_alerts: {
        Args: { p_hotel_id: string; p_now?: string }
        Returns: number
      }
      recompute_maintenance_occurrence_status: {
        Args: { p_occurrence_id: string }
        Returns: Database["public"]["Enums"]["maintenance_occurrence_status"]
      }
      release_maintenance_room_block: {
        Args: {
          p_actor_id: string
          p_block_id: string
          p_hotel_id: string
          p_reason: string
        }
        Returns: string
      }
      reorder_consumption_offers: {
        Args: {
          p_actor_id: string
          p_hotel_id: string
          p_ids: string[]
          p_point_id: string
        }
        Returns: string
      }
      reorder_consumption_points: {
        Args: { p_actor_id: string; p_hotel_id: string; p_ids: string[] }
        Returns: string
      }
      request_consumption_correction: {
        Args: {
          p_actor_id: string
          p_expected_version: number
          p_hotel_id: string
          p_items: Json
          p_kind: Database["public"]["Enums"]["consumption_correction_kind"]
          p_order_id: string
          p_reason: string
        }
        Returns: Json
      }
      resolve_consumption_offer_snapshot: {
        Args: { p_hotel_id: string; p_occurred_at: string; p_offer_id: string }
        Returns: Json
      }
      reverse_maintenance_financial_settlement: {
        Args: {
          p_actor_id: string
          p_hotel_id: string
          p_reason: string
          p_reversed_at?: string
          p_settlement_id: string
        }
        Returns: string
      }
      set_commercial_agreement_revision_points: {
        Args: {
          p_actor_id: string
          p_hotel_id: string
          p_point_ids: string[]
          p_revision_id: string
        }
        Returns: string
      }
      set_maintenance_notification_status: {
        Args: {
          p_hotel_id: string
          p_notification_id: string
          p_recipient_id: string
          p_status: Database["public"]["Enums"]["maintenance_notification_status"]
        }
        Returns: boolean
      }
      settle_maintenance_cost_item: {
        Args: {
          p_actor_id: string
          p_amount: number
          p_cost_item_id: string
          p_hotel_id: string
          p_method: string
          p_note?: string
          p_paid_at?: string
          p_reference_code?: string
        }
        Returns: string
      }
      settle_maintenance_recovery: {
        Args: {
          p_actor_id: string
          p_allocations?: Json
          p_amount: number
          p_hotel_id: string
          p_method: string
          p_note?: string
          p_paid_at?: string
          p_recovery_id: string
          p_reference_code?: string
        }
        Returns: string
      }
      terminate_commercial_agreement_revision: {
        Args: {
          p_actor_id: string
          p_ends_on: string
          p_hotel_id: string
          p_revision_id: string
        }
        Returns: string
      }
      transition_maintenance_cost_item: {
        Args: {
          p_action: string
          p_actor_id: string
          p_cost_item_id: string
          p_hotel_id: string
          p_reason?: string
        }
        Returns: string
      }
      transition_maintenance_recovery: {
        Args: {
          p_action: string
          p_actor_id: string
          p_hotel_id: string
          p_reason?: string
          p_recovery_id: string
        }
        Returns: string
      }
      transition_maintenance_supplier_work: {
        Args: {
          p_action: string
          p_actor_id: string
          p_contract_id?: string
          p_external_reference?: string
          p_hotel_id: string
          p_notes?: string
          p_supplier_id?: string
          p_work_order_id: string
        }
        Returns: string
      }
      transition_maintenance_work_order: {
        Args: {
          p_action: string
          p_actor_id: string
          p_assigned_to?: string
          p_diagnosis?: string
          p_hotel_id: string
          p_notes?: string
          p_waiting_reason?: Database["public"]["Enums"]["maintenance_waiting_reason"]
          p_work_order_id: string
        }
        Returns: string
      }
      update_role_with_permissions: {
        Args: {
          p_id: string
          p_payload: Json
          p_permission_ids: string[]
          p_should_replace_permissions?: boolean
        }
        Returns: {
          id: string
          result: string
        }[]
      }
      update_user_with_roles:
        | {
            Args: {
              p_id: string
              p_payload: Json
              p_role_assignments: Database["public"]["CompositeTypes"]["admin_role_assignment_input"][]
              p_should_replace_roles?: boolean
            }
            Returns: {
              id: string
              result: string
            }[]
          }
        | {
            Args: {
              p_id: string
              p_payload: Json
              p_role_ids: string[]
              p_should_replace_roles?: boolean
            }
            Returns: {
              id: string
              result: string
            }[]
          }
      upsert_maintenance_contract: {
        Args: {
          p_actor_id: string
          p_category_ids: string[]
          p_commercial_terms: string
          p_contract_amount: number
          p_contract_id: string
          p_contract_number: string
          p_currency: string
          p_ends_on: string
          p_hotel_id: string
          p_kind: Database["public"]["Enums"]["maintenance_contract_kind"]
          p_location_ids: string[]
          p_renewal_notice_on: string
          p_resolution_hours: number
          p_response_hours: number
          p_scope_notes: string
          p_starts_on: string
          p_status: Database["public"]["Enums"]["maintenance_contract_status"]
          p_supplier_id: string
          p_termination_reason?: string
        }
        Returns: string
      }
      upsert_maintenance_preventive_plan: {
        Args: {
          p_actor_id: string
          p_assigned_to: string
          p_blocking_recommended: boolean
          p_category_id: string
          p_completion_due_hours: number
          p_contract_id: string
          p_ends_on: string
          p_generation_lead_days: number
          p_hotel_id: string
          p_instructions: string
          p_local_time: string
          p_location_id: string
          p_name: string
          p_plan_id: string
          p_priority: Database["public"]["Enums"]["maintenance_priority"]
          p_recurrence_interval: number
          p_recurrence_unit: Database["public"]["Enums"]["maintenance_recurrence_unit"]
          p_requires_inspection: boolean
          p_room_id: string
          p_starts_on: string
          p_supplier_id: string
          p_tasks: Json
        }
        Returns: string
      }
      validate_commercial_actor: {
        Args: { p_actor_id: string; p_hotel_id: string }
        Returns: undefined
      }
      validate_reservation_capacity: {
        Args: { p_reservation_id: string }
        Returns: undefined
      }
    }
    Enums: {
      catalog_audit_entity: "product" | "product_category"
      commercial_audit_entity:
        | "partner"
        | "partner_contact"
        | "agreement"
        | "agreement_revision"
        | "agreement_revision_point"
      commercial_contact_purpose: "operational" | "financial" | "general"
      commercial_model: "fixed_rent" | "revenue_share" | "hybrid"
      commercial_payment_recipient: "hotel" | "partner" | "both"
      commercial_rent_frequency: "monthly" | "quarterly" | "yearly"
      commercial_revision_status: "draft" | "activated" | "terminated"
      consumption_billing_mode:
        | "hotel_immediate"
        | "stay_folio"
        | "partner_direct"
      consumption_configuration_entity:
        | "consumption_point"
        | "consumption_offer"
      consumption_correction_kind: "partial_adjustment" | "full_void"
      consumption_correction_status:
        | "pending"
        | "approved"
        | "rejected"
        | "awaiting_refund"
        | "awaiting_partner_refund"
        | "completed"
      consumption_order_disposition:
        | "charged"
        | "courtesy"
        | "legacy_unclassified"
      consumption_payment_method:
        | "cash"
        | "pix"
        | "credit_card"
        | "debit_card"
        | "bank_transfer"
      consumption_policy_source: "inherit" | "override"
      maintenance_asset_lifecycle: "active" | "out_of_service" | "retired"
      maintenance_automation_status: "running" | "completed" | "failed"
      maintenance_contract_kind: "fixed" | "per_service" | "warranty" | "other"
      maintenance_contract_status: "draft" | "active" | "expired" | "terminated"
      maintenance_cost_kind: "material" | "labor" | "external_service" | "other"
      maintenance_finance_approval_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "canceled"
      maintenance_finance_settlement_status:
        | "not_posted"
        | "open"
        | "partially_settled"
        | "settled"
        | "reversed"
      maintenance_inspection_result: "approved" | "rejected"
      maintenance_liability_status:
        | "not_applicable"
        | "not_assessed"
        | "suspected"
        | "confirmed"
        | "dismissed"
      maintenance_location_kind: "area" | "equipment"
      maintenance_notification_status: "unread" | "read" | "dismissed"
      maintenance_occurrence_kind:
        | "damage"
        | "defect"
        | "wear"
        | "safety_risk"
        | "special_cleaning"
        | "other"
        | "preventive"
      maintenance_occurrence_status:
        | "reported"
        | "triaged"
        | "in_progress"
        | "awaiting_inspection"
        | "awaiting_liability"
        | "resolved"
        | "canceled"
      maintenance_preventive_plan_status: "active" | "paused" | "inactive"
      maintenance_preventive_run_status:
        | "scheduled"
        | "generated"
        | "deferred"
        | "skipped"
        | "rescheduled"
      maintenance_priority: "low" | "normal" | "high" | "critical"
      maintenance_recurrence_unit: "daily" | "weekly" | "monthly" | "yearly"
      maintenance_responsible_party:
        | "guest"
        | "hotel"
        | "supplier"
        | "normal_wear"
      maintenance_supplier_status: "active" | "inactive"
      maintenance_supplier_work_status:
        | "not_sent"
        | "sent"
        | "accepted"
        | "in_service"
        | "completed"
        | "canceled"
      maintenance_waiting_reason:
        | "parts"
        | "vendor"
        | "authorization"
        | "access"
        | "other"
      maintenance_work_order_status:
        | "pending"
        | "assigned"
        | "in_progress"
        | "paused"
        | "waiting"
        | "awaiting_inspection"
        | "completed"
        | "canceled"
      payment_status: "pending" | "partial" | "paid" | "refunded"
      product_kind: "physical" | "service"
      product_provider_type: "hotel" | "partner"
      product_sales_unit:
        | "unit"
        | "portion"
        | "person"
        | "hour"
        | "daily"
        | "service"
      product_status: "active" | "inactive"
      reservation_source: "front_desk" | "website" | "phone" | "agency"
      reservation_status:
        | "pending"
        | "confirmed"
        | "checked_in"
        | "checked_out"
        | "canceled"
        | "no_show"
      room_block_status: "blocked" | "maintenance"
      room_status: "available" | "occupied" | "maintenance" | "blocked"
      stay_checkout_record_kind: "operational" | "legacy"
      stay_folio_direction: "debit" | "credit"
      stay_folio_kind:
        | "lodging"
        | "maintenance_charge"
        | "consumption_charge"
        | "payment"
        | "refund"
        | "adjustment"
      stay_payment_batch_kind: "regular" | "checkout" | "legacy"
      stay_status:
        | "checked_in"
        | "checked_out"
        | "no_show"
        | "canceled"
        | "confirmed"
      transaction_status:
        | "PENDING"
        | "COMPLETED"
        | "FAILED"
        | "CANCELLED"
        | "REFUNDED"
      transaction_type: "INCOME" | "EXPENSE" | "REFUND"
    }
    CompositeTypes: {
      admin_role_assignment_input: {
        role_id: string | null
        hotel_id: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      catalog_audit_entity: ["product", "product_category"],
      commercial_audit_entity: [
        "partner",
        "partner_contact",
        "agreement",
        "agreement_revision",
        "agreement_revision_point",
      ],
      commercial_contact_purpose: ["operational", "financial", "general"],
      commercial_model: ["fixed_rent", "revenue_share", "hybrid"],
      commercial_payment_recipient: ["hotel", "partner", "both"],
      commercial_rent_frequency: ["monthly", "quarterly", "yearly"],
      commercial_revision_status: ["draft", "activated", "terminated"],
      consumption_billing_mode: [
        "hotel_immediate",
        "stay_folio",
        "partner_direct",
      ],
      consumption_configuration_entity: [
        "consumption_point",
        "consumption_offer",
      ],
      consumption_correction_kind: ["partial_adjustment", "full_void"],
      consumption_correction_status: [
        "pending",
        "approved",
        "rejected",
        "awaiting_refund",
        "awaiting_partner_refund",
        "completed",
      ],
      consumption_order_disposition: [
        "charged",
        "courtesy",
        "legacy_unclassified",
      ],
      consumption_payment_method: [
        "cash",
        "pix",
        "credit_card",
        "debit_card",
        "bank_transfer",
      ],
      consumption_policy_source: ["inherit", "override"],
      maintenance_asset_lifecycle: ["active", "out_of_service", "retired"],
      maintenance_automation_status: ["running", "completed", "failed"],
      maintenance_contract_kind: ["fixed", "per_service", "warranty", "other"],
      maintenance_contract_status: ["draft", "active", "expired", "terminated"],
      maintenance_cost_kind: ["material", "labor", "external_service", "other"],
      maintenance_finance_approval_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "canceled",
      ],
      maintenance_finance_settlement_status: [
        "not_posted",
        "open",
        "partially_settled",
        "settled",
        "reversed",
      ],
      maintenance_inspection_result: ["approved", "rejected"],
      maintenance_liability_status: [
        "not_applicable",
        "not_assessed",
        "suspected",
        "confirmed",
        "dismissed",
      ],
      maintenance_location_kind: ["area", "equipment"],
      maintenance_notification_status: ["unread", "read", "dismissed"],
      maintenance_occurrence_kind: [
        "damage",
        "defect",
        "wear",
        "safety_risk",
        "special_cleaning",
        "other",
        "preventive",
      ],
      maintenance_occurrence_status: [
        "reported",
        "triaged",
        "in_progress",
        "awaiting_inspection",
        "awaiting_liability",
        "resolved",
        "canceled",
      ],
      maintenance_preventive_plan_status: ["active", "paused", "inactive"],
      maintenance_preventive_run_status: [
        "scheduled",
        "generated",
        "deferred",
        "skipped",
        "rescheduled",
      ],
      maintenance_priority: ["low", "normal", "high", "critical"],
      maintenance_recurrence_unit: ["daily", "weekly", "monthly", "yearly"],
      maintenance_responsible_party: [
        "guest",
        "hotel",
        "supplier",
        "normal_wear",
      ],
      maintenance_supplier_status: ["active", "inactive"],
      maintenance_supplier_work_status: [
        "not_sent",
        "sent",
        "accepted",
        "in_service",
        "completed",
        "canceled",
      ],
      maintenance_waiting_reason: [
        "parts",
        "vendor",
        "authorization",
        "access",
        "other",
      ],
      maintenance_work_order_status: [
        "pending",
        "assigned",
        "in_progress",
        "paused",
        "waiting",
        "awaiting_inspection",
        "completed",
        "canceled",
      ],
      payment_status: ["pending", "partial", "paid", "refunded"],
      product_kind: ["physical", "service"],
      product_provider_type: ["hotel", "partner"],
      product_sales_unit: [
        "unit",
        "portion",
        "person",
        "hour",
        "daily",
        "service",
      ],
      product_status: ["active", "inactive"],
      reservation_source: ["front_desk", "website", "phone", "agency"],
      reservation_status: [
        "pending",
        "confirmed",
        "checked_in",
        "checked_out",
        "canceled",
        "no_show",
      ],
      room_block_status: ["blocked", "maintenance"],
      room_status: ["available", "occupied", "maintenance", "blocked"],
      stay_checkout_record_kind: ["operational", "legacy"],
      stay_folio_direction: ["debit", "credit"],
      stay_folio_kind: [
        "lodging",
        "maintenance_charge",
        "consumption_charge",
        "payment",
        "refund",
        "adjustment",
      ],
      stay_payment_batch_kind: ["regular", "checkout", "legacy"],
      stay_status: [
        "checked_in",
        "checked_out",
        "no_show",
        "canceled",
        "confirmed",
      ],
      transaction_status: [
        "PENDING",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
        "REFUNDED",
      ],
      transaction_type: ["INCOME", "EXPENSE", "REFUND"],
    },
  },
} as const
