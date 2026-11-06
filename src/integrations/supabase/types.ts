export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      app_accounts: {
        Row: {
          created_at: string;
          failed_attempts: number;
          full_name: string | null;
          id: string;
          is_active: boolean;
          is_admin: boolean;
          last_login_at: string | null;
          locked_until: string | null;
          password_hash: string;
          phone: string | null;
          updated_at: string;
          username: string;
          username_lower: string;
        };
        Insert: {
          created_at?: string;
          failed_attempts?: number;
          full_name?: string | null;
          id: string;
          is_active?: boolean;
          is_admin?: boolean;
          last_login_at?: string | null;
          locked_until?: string | null;
          password_hash: string;
          phone?: string | null;
          updated_at?: string;
          username: string;
          username_lower: string;
        };
        Update: {
          created_at?: string;
          failed_attempts?: number;
          full_name?: string | null;
          id?: string;
          is_active?: boolean;
          is_admin?: boolean;
          last_login_at?: string | null;
          locked_until?: string | null;
          password_hash?: string;
          phone?: string | null;
          updated_at?: string;
          username?: string;
          username_lower?: string;
        };
        Relationships: [];
      };
      opportunities: {
        Row: {
          apply_url: string | null;
          category: string;
          created_at: string;
          created_by: string | null;
          deadline: string | null;
          description: string | null;
          description_ar: string | null;
          featured: boolean;
          id: string;
          image_url: string | null;
          location: string | null;
          organization: string | null;
          status: Database["public"]["Enums"]["opp_status"];
          title: string;
          title_ar: string | null;
          updated_at: string;
        };
        Insert: {
          apply_url?: string | null;
          category: string;
          created_at?: string;
          created_by?: string | null;
          deadline?: string | null;
          description?: string | null;
          description_ar?: string | null;
          featured?: boolean;
          id?: string;
          image_url?: string | null;
          location?: string | null;
          organization?: string | null;
          status?: Database["public"]["Enums"]["opp_status"];
          title: string;
          title_ar?: string | null;
          updated_at?: string;
        };
        Update: {
          apply_url?: string | null;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          deadline?: string | null;
          description?: string | null;
          description_ar?: string | null;
          featured?: boolean;
          id?: string;
          image_url?: string | null;
          location?: string | null;
          organization?: string | null;
          status?: Database["public"]["Enums"]["opp_status"];
          title?: string;
          title_ar?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      partners: {
        Row: {
          created_at: string;
          id: string;
          logo_url: string | null;
          name: string;
          website_url: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name: string;
          website_url?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name?: string;
          website_url?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          university: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          university?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          university?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_opportunities: {
        Row: {
          created_at: string;
          id: string;
          opportunity_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          opportunity_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          opportunity_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_opportunities_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      site_store: {
        Row: {
          created_at: string;
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          created_at?: string;
          key: string;
          updated_at?: string;
          value?: Json;
        };
        Update: {
          created_at?: string;
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      site_store_history: {
        Row: {
          created_at: string;
          id: number;
          key: string;
          source: string | null;
          value: Json;
        };
        Insert: {
          created_at?: string;
          id?: number;
          key: string;
          source?: string | null;
          value: Json;
        };
        Update: {
          created_at?: string;
          id?: number;
          key?: string;
          source?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "user";
      opp_status: "visible" | "soon" | "hidden";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      opp_status: ["visible", "soon", "hidden"],
    },
  },
} as const;
