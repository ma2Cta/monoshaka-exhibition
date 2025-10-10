// データベースの型定義

export interface Recording {
  id: string;
  file_path: string;
  duration: number | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      recordings: {
        Row: Recording;
        Insert: Omit<Recording, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Recording, 'id' | 'created_at'>>;
      };
    };
  };
}
