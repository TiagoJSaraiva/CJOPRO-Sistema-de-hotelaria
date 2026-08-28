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
          created_at: string
          end_date: string
          id: string
          label: string | null
          room_id: string
          start_date: string
          status: Database["public"]["Enums"]["room_block_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          label?: string | null
          room_id: string
          start_date: string
          status?: Database["public"]["Enums"]["room_block_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          label?: string | null
          room_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["room_block_status"]
          updated_at?: string
        }
        Relationships: [
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
