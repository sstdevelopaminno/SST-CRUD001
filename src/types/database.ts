export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: string;
          department: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          role?: string;
          department?: string | null;
          active?: boolean;
        };
        Update: {
          email?: string;
          full_name?: string;
          role?: string;
          department?: string | null;
          active?: boolean;
        };
      };
      roles: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          code: string;
          name: string;
          description?: string | null;
        };
        Update: {
          code?: string;
          name?: string;
          description?: string | null;
        };
      };
      permissions: {
        Row: {
          id: string;
          key: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          key: string;
          description?: string | null;
        };
        Update: {
          key?: string;
          description?: string | null;
        };
      };
      role_permissions: {
        Row: {
          id: string;
          role_code: string;
          permission_key: string;
          created_at: string;
        };
        Insert: {
          role_code: string;
          permission_key: string;
        };
        Update: {
          role_code?: string;
          permission_key?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          status: string;
          owner_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          email?: string | null;
          phone?: string | null;
          status?: string;
          owner_id?: string | null;
        };
        Update: {
          name?: string;
          email?: string | null;
          phone?: string | null;
          status?: string;
          owner_id?: string | null;
        };
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          customer_id: string | null;
          status: string;
          owner_id: string | null;
          progress: number;
          due_date: string | null;
          commission_rate: number;
          active: boolean;
          is_template: boolean;
          require_customer_name: boolean;
          require_customer_phone: boolean;
          require_customer_address: boolean;
          require_face_photo: boolean;
          require_id_card: boolean;
          require_id_address: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          description?: string | null;
          customer_id?: string | null;
          status?: string;
          owner_id?: string | null;
          progress?: number;
          due_date?: string | null;
          commission_rate?: number;
          active?: boolean;
          is_template?: boolean;
          require_customer_name?: boolean;
          require_customer_phone?: boolean;
          require_customer_address?: boolean;
          require_face_photo?: boolean;
          require_id_card?: boolean;
          require_id_address?: boolean;
        };
        Update: {
          name?: string;
          description?: string | null;
          customer_id?: string | null;
          status?: string;
          owner_id?: string | null;
          progress?: number;
          due_date?: string | null;
          commission_rate?: number;
          active?: boolean;
          is_template?: boolean;
          require_customer_name?: boolean;
          require_customer_phone?: boolean;
          require_customer_address?: boolean;
          require_face_photo?: boolean;
          require_id_card?: boolean;
          require_id_address?: boolean;
        };
      };
      project_cases: {
        Row: {
          id: string;
          project_id: string;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          customer_address: string | null;
          customer_face_photo_path: string | null;
          customer_id_card_path: string | null;
          customer_id_address: string | null;
          opened_by: string;
          sales_owner_id: string;
          commission_owner_id: string;
          commission_rate: number;
          approval_status: string;
          lifecycle_status: string;
          opened_at: string;
          commission_period_start: string | null;
          commission_period_end: string | null;
          commission_payout_window_start: string | null;
          commission_payout_window_end: string | null;
          extra_data: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          project_id: string;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          customer_address?: string | null;
          customer_face_photo_path?: string | null;
          customer_id_card_path?: string | null;
          customer_id_address?: string | null;
          opened_by: string;
          sales_owner_id: string;
          commission_owner_id: string;
          commission_rate?: number;
          approval_status?: string;
          lifecycle_status?: string;
          opened_at?: string;
          commission_period_start?: string | null;
          commission_period_end?: string | null;
          commission_payout_window_start?: string | null;
          commission_payout_window_end?: string | null;
          extra_data?: Json | null;
        };
        Update: {
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          customer_address?: string | null;
          customer_face_photo_path?: string | null;
          customer_id_card_path?: string | null;
          customer_id_address?: string | null;
          sales_owner_id?: string;
          commission_owner_id?: string;
          commission_rate?: number;
          approval_status?: string;
          lifecycle_status?: string;
          commission_period_start?: string | null;
          commission_period_end?: string | null;
          commission_payout_window_start?: string | null;
          commission_payout_window_end?: string | null;
          extra_data?: Json | null;
        };
      };
      project_case_transfers: {
        Row: {
          id: string;
          project_case_id: string;
          from_sales_id: string;
          to_sales_id: string;
          reason: string | null;
          status: string;
          requested_by: string;
          approver_id: string | null;
          approver_role: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          project_case_id: string;
          from_sales_id: string;
          to_sales_id: string;
          reason?: string | null;
          status?: string;
          requested_by: string;
          approver_id?: string | null;
          approver_role?: string | null;
          approved_at?: string | null;
        };
        Update: {
          from_sales_id?: string;
          to_sales_id?: string;
          reason?: string | null;
          status?: string;
          requested_by?: string;
          approver_id?: string | null;
          approver_role?: string | null;
          approved_at?: string | null;
        };
      };
      sales_profiles: {
        Row: {
          id: string;
          user_id: string | null;
          employee_code: string | null;
          full_name: string;
          phone: string | null;
          current_address: string | null;
          id_card_address: string | null;
          id_card_number: string | null;
          status: string;
          start_date: string | null;
          end_date: string | null;
          manager_user_id: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string | null;
          employee_code?: string | null;
          full_name: string;
          phone?: string | null;
          current_address?: string | null;
          id_card_address?: string | null;
          id_card_number?: string | null;
          status?: string;
          start_date?: string | null;
          end_date?: string | null;
          manager_user_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: {
          user_id?: string | null;
          employee_code?: string | null;
          full_name?: string;
          phone?: string | null;
          current_address?: string | null;
          id_card_address?: string | null;
          id_card_number?: string | null;
          status?: string;
          start_date?: string | null;
          end_date?: string | null;
          manager_user_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
      };
      sales_profile_documents: {
        Row: {
          id: string;
          sales_profile_id: string;
          document_type: string;
          file_path: string;
          file_name: string | null;
          mime_type: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sales_profile_id: string;
          document_type: string;
          file_path: string;
          file_name?: string | null;
          mime_type?: string | null;
          uploaded_by?: string | null;
        };
        Update: {
          document_type?: string;
          file_path?: string;
          file_name?: string | null;
          mime_type?: string | null;
          uploaded_by?: string | null;
        };
      };
      sales_commission_cycles: {
        Row: {
          id: string;
          sales_profile_id: string;
          cycle_label: string | null;
          period_start: string;
          period_end: string;
          payout_window_start: string;
          payout_window_end: string;
          gross_sales: number;
          approved_sales: number;
          commission_rate_avg: number;
          commission_amount: number;
          status: string;
          submitted_by: string | null;
          approved_by: string | null;
          approved_at: string | null;
          paid_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          sales_profile_id: string;
          cycle_label?: string | null;
          period_start: string;
          period_end: string;
          payout_window_start: string;
          payout_window_end: string;
          gross_sales?: number;
          approved_sales?: number;
          commission_rate_avg?: number;
          commission_amount?: number;
          status?: string;
          submitted_by?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          paid_at?: string | null;
          notes?: string | null;
        };
        Update: {
          cycle_label?: string | null;
          period_start?: string;
          period_end?: string;
          payout_window_start?: string;
          payout_window_end?: string;
          gross_sales?: number;
          approved_sales?: number;
          commission_rate_avg?: number;
          commission_amount?: number;
          status?: string;
          submitted_by?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          paid_at?: string | null;
          notes?: string | null;
        };
      };      jobs: {
        Row: {
          id: string;
          project_id: string | null;
          title: string;
          assignee_id: string | null;
          status: string;
          priority: string;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          project_id?: string | null;
          title: string;
          assignee_id?: string | null;
          status?: string;
          priority?: string;
          due_date?: string | null;
        };
        Update: {
          project_id?: string | null;
          title?: string;
          assignee_id?: string | null;
          status?: string;
          priority?: string;
          due_date?: string | null;
        };
      };
      invoices: {
        Row: {
          id: string;
          customer_id: string | null;
          project_id: string | null;
          invoice_no: string;
          amount: number;
          status: string;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          customer_id?: string | null;
          project_id?: string | null;
          invoice_no: string;
          amount: number;
          status?: string;
          due_date?: string | null;
        };
        Update: {
          customer_id?: string | null;
          project_id?: string | null;
          invoice_no?: string;
          amount?: number;
          status?: string;
          due_date?: string | null;
        };
      };
      purchase_orders: {
        Row: {
          id: string;
          po_no: string;
          vendor_name: string;
          amount: number;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          po_no: string;
          vendor_name: string;
          amount: number;
          status?: string;
        };
        Update: {
          po_no?: string;
          vendor_name?: string;
          amount?: number;
          status?: string;
        };
      };
      approvals: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          requester_id: string;
          approver_id: string | null;
          level: number;
          status: string;
          note: string | null;
          signature_id: string | null;
          approved_at: string | null;
          created_at: string;
        };
        Insert: {
          entity_type: string;
          entity_id: string;
          requester_id: string;
          approver_id?: string | null;
          level?: number;
          status?: string;
          note?: string | null;
          signature_id?: string | null;
          approved_at?: string | null;
        };
        Update: {
          approver_id?: string | null;
          level?: number;
          status?: string;
          note?: string | null;
          signature_id?: string | null;
          approved_at?: string | null;
        };
      };
      documents: {
        Row: {
          id: string;
          title: string;
          file_path: string;
          file_type: string;
          file_size: number;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          title: string;
          file_path: string;
          file_type: string;
          file_size: number;
          uploaded_by: string;
        };
        Update: {
          title?: string;
          file_path?: string;
          file_type?: string;
          file_size?: number;
        };
      };
      signatures: {
        Row: {
          id: string;
          document_id: string;
          signer_id: string;
          signature_data_url: string;
          signed_at: string;
          ip_address: string | null;
          device_info: string | null;
          metadata: Json | null;
        };
        Insert: {
          document_id: string;
          signer_id: string;
          signature_data_url: string;
          ip_address?: string | null;
          device_info?: string | null;
          metadata?: Json | null;
        };
        Update: {
          signature_data_url?: string;
          ip_address?: string | null;
          device_info?: string | null;
          metadata?: Json | null;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action_type: string;
          entity_type: string;
          entity_id: string | null;
          timestamp: string;
          ip_address: string | null;
          device_info: string | null;
          location: string | null;
          metadata: Json | null;
        };
        Insert: {
          user_id?: string | null;
          action_type: string;
          entity_type: string;
          entity_id?: string | null;
          ip_address?: string | null;
          device_info?: string | null;
          location?: string | null;
          metadata?: Json | null;
        };
        Update: {
          location?: string | null;
          metadata?: Json | null;
        };
      };
      api_configs: {
        Row: {
          id: string;
          name: string;
          base_url: string;
          api_key_encrypted: string;
          headers: Json | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          base_url: string;
          api_key_encrypted: string;
          headers?: Json | null;
          is_active?: boolean;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          base_url?: string;
          api_key_encrypted?: string;
          headers?: Json | null;
          is_active?: boolean;
        };
      };
      feature_flags: {
        Row: {
          id: string;
          key: string;
          enabled: boolean;
          module: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          enabled?: boolean;
          module: string;
          description?: string | null;
        };
        Update: {
          enabled?: boolean;
          module?: string;
          description?: string | null;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          read: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          title: string;
          body: string;
          read?: boolean;
        };
        Update: {
          read?: boolean;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
