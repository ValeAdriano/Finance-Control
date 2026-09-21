export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      allocation_targets: {
        Row: {
          asset_class: Database["public"]["Enums"]["asset_class"];
          target: number;
          user_id: string;
        };
        Insert: {
          asset_class: Database["public"]["Enums"]["asset_class"];
          target: number;
          user_id: string;
        };
        Update: {
          asset_class?: Database["public"]["Enums"]["asset_class"];
          target?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      asset_fundamentals: {
        Row: {
          asset_id: string;
          fetched_at: string;
          payload: Json;
          reference_date: string;
          source: Database["public"]["Enums"]["data_source"];
          user_id: string;
        };
        Insert: {
          asset_id: string;
          fetched_at?: string;
          payload: Json;
          reference_date: string;
          source?: Database["public"]["Enums"]["data_source"];
          user_id: string;
        };
        Update: {
          asset_id?: string;
          fetched_at?: string;
          payload?: Json;
          reference_date?: string;
          source?: Database["public"]["Enums"]["data_source"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asset_fundamentals_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      assets: {
        Row: {
          asset_class: Database["public"]["Enums"]["asset_class"];
          created_at: string;
          currency: Database["public"]["Enums"]["currency_code"];
          id: string;
          institution_id: string | null;
          name: string;
          sector: string | null;
          slug: string;
          symbol: string;
          user_id: string;
        };
        Insert: {
          asset_class: Database["public"]["Enums"]["asset_class"];
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          id?: string;
          institution_id?: string | null;
          name: string;
          sector?: string | null;
          slug: string;
          symbol: string;
          user_id: string;
        };
        Update: {
          asset_class?: Database["public"]["Enums"]["asset_class"];
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          id?: string;
          institution_id?: string | null;
          name?: string;
          sector?: string | null;
          slug?: string;
          symbol?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assets_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_categories: {
        Row: {
          color: string;
          id: string;
          monthly_budget: number | null;
          name: string;
          user_id: string;
        };
        Insert: {
          color?: string;
          id?: string;
          monthly_budget?: number | null;
          name: string;
          user_id: string;
        };
        Update: {
          color?: string;
          id?: string;
          monthly_budget?: number | null;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      expense_entries: {
        Row: {
          amount: number;
          category_id: string | null;
          created_at: string;
          date: string;
          description: string;
          external_id: string | null;
          id: string;
          source: Database["public"]["Enums"]["data_source"];
          user_id: string;
        };
        Insert: {
          amount: number;
          category_id?: string | null;
          created_at?: string;
          date: string;
          description: string;
          external_id?: string | null;
          id?: string;
          source?: Database["public"]["Enums"]["data_source"];
          user_id: string;
        };
        Update: {
          amount?: number;
          category_id?: string | null;
          created_at?: string;
          date?: string;
          description?: string;
          external_id?: string | null;
          id?: string;
          source?: Database["public"]["Enums"]["data_source"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_entries_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      holdings: {
        Row: {
          asset_id: string;
          average_price: number;
          day_change: number;
          last_price: number;
          quantity: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          asset_id: string;
          average_price?: number;
          day_change?: number;
          last_price?: number;
          quantity?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          asset_id?: string;
          average_price?: number;
          day_change?: number;
          last_price?: number;
          quantity?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "holdings_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      institutions: {
        Row: {
          created_at: string;
          credentials_iv: string | null;
          encrypted_credentials: string | null;
          id: string;
          last_sync_at: string | null;
          name: string;
          provider: Database["public"]["Enums"]["data_source"];
          status: Database["public"]["Enums"]["institution_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          credentials_iv?: string | null;
          encrypted_credentials?: string | null;
          id?: string;
          last_sync_at?: string | null;
          name: string;
          provider?: Database["public"]["Enums"]["data_source"];
          status?: Database["public"]["Enums"]["institution_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          credentials_iv?: string | null;
          encrypted_credentials?: string | null;
          id?: string;
          last_sync_at?: string | null;
          name?: string;
          provider?: Database["public"]["Enums"]["data_source"];
          status?: Database["public"]["Enums"]["institution_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      journal_entries: {
        Row: {
          asset_id: string | null;
          body: string;
          created_at: string;
          date: string;
          id: string;
          tags: string[];
          title: string;
          user_id: string;
        };
        Insert: {
          asset_id?: string | null;
          body?: string;
          created_at?: string;
          date?: string;
          id?: string;
          tags?: string[];
          title: string;
          user_id: string;
        };
        Update: {
          asset_id?: string | null;
          body?: string;
          created_at?: string;
          date?: string;
          id?: string;
          tags?: string[];
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journal_entries_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      net_worth_history: {
        Row: {
          by_class: Json;
          contributed: number;
          date: string;
          total: number;
          user_id: string;
        };
        Insert: {
          by_class: Json;
          contributed: number;
          date: string;
          total: number;
          user_id: string;
        };
        Update: {
          by_class?: Json;
          contributed?: number;
          date?: string;
          total?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      price_history: {
        Row: {
          asset_id: string;
          close: number;
          created_at: string;
          date: string;
          source: Database["public"]["Enums"]["data_source"];
          user_id: string;
        };
        Insert: {
          asset_id: string;
          close: number;
          created_at?: string;
          date: string;
          source: Database["public"]["Enums"]["data_source"];
          user_id: string;
        };
        Update: {
          asset_id?: string;
          close?: number;
          created_at?: string;
          date?: string;
          source?: Database["public"]["Enums"]["data_source"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_history_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      scoring_settings: {
        Row: {
          settings: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          settings: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          settings?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          asset_id: string;
          created_at: string;
          date: string;
          external_id: string | null;
          fees: number;
          id: string;
          kind: Database["public"]["Enums"]["transaction_kind"];
          notes: string | null;
          quantity: number;
          source: Database["public"]["Enums"]["data_source"];
          unit_price: number;
          user_id: string;
        };
        Insert: {
          asset_id: string;
          created_at?: string;
          date: string;
          external_id?: string | null;
          fees?: number;
          id?: string;
          kind: Database["public"]["Enums"]["transaction_kind"];
          notes?: string | null;
          quantity: number;
          source?: Database["public"]["Enums"]["data_source"];
          unit_price: number;
          user_id: string;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          date?: string;
          external_id?: string | null;
          fees?: number;
          id?: string;
          kind?: Database["public"]["Enums"]["transaction_kind"];
          notes?: string | null;
          quantity?: number;
          source?: Database["public"]["Enums"]["data_source"];
          unit_price?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      watchlist: {
        Row: {
          added_at: string;
          asset_id: string;
          notes: string | null;
          target_price: number | null;
          user_id: string;
        };
        Insert: {
          added_at?: string;
          asset_id: string;
          notes?: string | null;
          target_price?: number | null;
          user_id: string;
        };
        Update: {
          added_at?: string;
          asset_id?: string;
          notes?: string | null;
          target_price?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "watchlist_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      keep_alive: { Args: never; Returns: undefined };
      prune_price_history: { Args: never; Returns: undefined };
    };
    Enums: {
      asset_class: "acao" | "fii" | "cripto" | "renda_fixa" | "agro";
      currency_code: "BRL" | "USD";
      data_source: "manual" | "pluggy" | "binance" | "brapi" | "nota_corretagem";
      fixed_income_indexer: "prefixado" | "cdi" | "ipca" | "selic";
      institution_status: "conectada" | "expirada" | "erro" | "manual";
      transaction_kind: "compra" | "venda" | "dividendo" | "juros" | "aporte" | "resgate" | "taxa";
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
      asset_class: ["acao", "fii", "cripto", "renda_fixa", "agro"],
      currency_code: ["BRL", "USD"],
      data_source: ["manual", "pluggy", "binance", "brapi", "nota_corretagem"],
      fixed_income_indexer: ["prefixado", "cdi", "ipca", "selic"],
      institution_status: ["conectada", "expirada", "erro", "manual"],
      transaction_kind: ["compra", "venda", "dividendo", "juros", "aporte", "resgate", "taxa"],
    },
  },
} as const;
