// データベースの型定義

export interface Recording {
  id: string;
  file_path: string;
  duration: number | null;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      recordings: {
        Row: Recording;
        Insert: {
          id?: string;
          file_path: string;
          duration: number | null;
          created_at?: string;
        };
        Update: {
          file_path?: string;
          duration?: number | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
