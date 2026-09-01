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
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
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
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
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
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
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
      maintenance_cost_items: {
        Row: {
          actual_amount: number | null
          approval_status: Database["public"]["Enums"]["maintenance_finance_approval_status"]
          approved_at: string | null
          approved_by: string | null
          canceled_at: string | null
          canceled_by: string | null
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
          created_at: string
          description: string | null
          display_order: number
          hotel_id: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["maintenance_location_kind"]
          name: string
          parent_location_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          hotel_id: string
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["maintenance_location_kind"]
          name: string
          parent_location_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          hotel_id?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["maintenance_location_kind"]
          name?: string
          parent_location_id?: string | null
          updated_at?: string
        }
        Relationships: [
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
          priority: Database["public"]["Enums"]["maintenance_priority"]
          reported_by: string
          resolved_at: string | null
          room_id: string | null
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
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          reported_by: string
          resolved_at?: string | null
          room_id?: string | null
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
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          reported_by?: string
          resolved_at?: string | null
          room_id?: string | null
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
      maintenance_recoveries: {
        Row: {
          approval_status: Database["public"]["Enums"]["maintenance_finance_approval_status"]
          approved_at: string | null
          approved_by: string | null
          canceled_at: string | null
          canceled_by: string | null
          charge_amount: number
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
        ]
      }
      maintenance_work_orders: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
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
      products: {
        Row: {
          category: string | null
          created_at: string
          hotel_id: string
          id: string
          name: string
          status: Database["public"]["Enums"]["product_status"]
          unit_price: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          hotel_id: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["product_status"]
          unit_price: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          hotel_id?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["product_status"]
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
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
      stay_consumption: {
        Row: {
          charged_unit_price: number
          consumption_date: string | null
          created_at: string
          id: string
          item_total_amount: number | null
          notes: string | null
          product_id: string
          quantity: number
          stay_id: string | null
          updated_at: string
        }
        Insert: {
          charged_unit_price: number
          consumption_date?: string | null
          created_at?: string
          id?: string
          item_total_amount?: number | null
          notes?: string | null
          product_id: string
          quantity: number
          stay_id?: string | null
          updated_at?: string
        }
        Update: {
          charged_unit_price?: number
          consumption_date?: string | null
          created_at?: string
          id?: string
          item_total_amount?: number | null
          notes?: string | null
          product_id?: string
          quantity?: number
          stay_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_consumption_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_consumption_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
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
      stays: {
        Row: {
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
      [_ in never]: never
    }
    Functions: {
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
      create_default_maintenance_categories: {
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
      validate_reservation_capacity: {
        Args: { p_reservation_id: string }
        Returns: undefined
      }
    }
    Enums: {
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
      maintenance_occurrence_kind:
        | "damage"
        | "defect"
        | "wear"
        | "safety_risk"
        | "special_cleaning"
        | "other"
      maintenance_occurrence_status:
        | "reported"
        | "triaged"
        | "in_progress"
        | "awaiting_inspection"
        | "awaiting_liability"
        | "resolved"
        | "canceled"
      maintenance_priority: "low" | "normal" | "high" | "critical"
      maintenance_responsible_party:
        | "guest"
        | "hotel"
        | "supplier"
        | "normal_wear"
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
      stay_folio_direction: "debit" | "credit"
      stay_folio_kind:
        | "lodging"
        | "maintenance_charge"
        | "payment"
        | "refund"
        | "adjustment"
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
      maintenance_occurrence_kind: [
        "damage",
        "defect",
        "wear",
        "safety_risk",
        "special_cleaning",
        "other",
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
      maintenance_priority: ["low", "normal", "high", "critical"],
      maintenance_responsible_party: [
        "guest",
        "hotel",
        "supplier",
        "normal_wear",
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
      stay_folio_direction: ["debit", "credit"],
      stay_folio_kind: [
        "lodging",
        "maintenance_charge",
        "payment",
        "refund",
        "adjustment",
      ],
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
