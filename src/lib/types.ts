// データベースの型定義

export interface Recording {
  id: string;
  file_path: string;
  duration: number | null;
  transcription?: string | null;
  created_at: string;
}

export interface Playlist {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaylistRecording {
  id: string;
  playlist_id: string;
  recording_id: string;
  order_index: number;
  added_at: string;
}

// プレイリスト詳細画面用の型（録音情報を含む）
export interface PlaylistWithRecordings extends Playlist {
  recordings: (PlaylistRecording & { recording: Recording })[];
  recordingCount?: number;
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
          transcription?: string | null;
          created_at?: string;
        };
        Update: {
          file_path?: string;
          duration?: number | null;
          transcription?: string | null;
        };
        Relationships: [];
      };
      playlists: {
        Row: Playlist;
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      playlist_recordings: {
        Row: PlaylistRecording;
        Insert: {
          id?: string;
          playlist_id: string;
          recording_id: string;
          order_index: number;
          added_at?: string;
        };
        Update: {
          order_index?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'playlist_recordings_playlist_id_fkey';
            columns: ['playlist_id'];
            referencedRelation: 'playlists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'playlist_recordings_recording_id_fkey';
            columns: ['recording_id'];
            referencedRelation: 'recordings';
            referencedColumns: ['id'];
          }
        ];
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
