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
          customer_id: string | null;
          status: string;
          owner_id: string | null;
          progress: number;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          customer_id?: string | null;
          status?: string;
          owner_id?: string | null;
          progress?: number;
          due_date?: string | null;
        };
        Update: {
          name?: string;
          customer_id?: string | null;
          status?: string;
          owner_id?: string | null;
          progress?: number;
          due_date?: string | null;
        };
      };
      jobs: {
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
          invoice_no: string;
          amount: number;
          status: string;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          customer_id?: string | null;
          invoice_no: string;
          amount: number;
          status?: string;
          due_date?: string | null;
        };
        Update: {
          customer_id?: string | null;
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
