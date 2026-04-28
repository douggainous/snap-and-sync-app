export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      favorite_list_items: {
        Row: {
          created_at: string
          id: string
          list_id: string
          menu_item_id: string
          note: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          menu_item_id: string
          note?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          menu_item_id?: string
          note?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "favorite_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "favorite_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_list_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_lists: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          slug: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          slug: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          slug?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      food_posts: {
        Row: {
          ai_tags: string[]
          created_at: string
          cuisine: string | null
          currency: string
          dietary_tags: string[]
          dish_name: string
          extracted_data: Json
          id: string
          image_path: string | null
          image_url: string | null
          is_draft: boolean
          latitude: number | null
          longitude: number | null
          ocr_text: string | null
          price: number | null
          rating: number | null
          restaurant_id: string | null
          restaurant_name: string
          review: string | null
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["post_visibility"]
        }
        Insert: {
          ai_tags?: string[]
          created_at?: string
          cuisine?: string | null
          currency?: string
          dietary_tags?: string[]
          dish_name: string
          extracted_data?: Json
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_draft?: boolean
          latitude?: number | null
          longitude?: number | null
          ocr_text?: string | null
          price?: number | null
          rating?: number | null
          restaurant_id?: string | null
          restaurant_name: string
          review?: string | null
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Update: {
          ai_tags?: string[]
          created_at?: string
          cuisine?: string | null
          currency?: string
          dietary_tags?: string[]
          dish_name?: string
          extracted_data?: Json
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_draft?: boolean
          latitude?: number | null
          longitude?: number | null
          ocr_text?: string | null
          price?: number | null
          rating?: number | null
          restaurant_id?: string | null
          restaurant_name?: string
          review?: string | null
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "food_posts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_extractions: {
        Row: {
          confirmed_items: Json
          created_at: string
          extracted_items: Json
          id: string
          menu_photo_id: string | null
          raw_ocr_text: string | null
          restaurant_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confirmed_items?: Json
          created_at?: string
          extracted_items?: Json
          id?: string
          menu_photo_id?: string | null
          raw_ocr_text?: string | null
          restaurant_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confirmed_items?: Json
          created_at?: string
          extracted_items?: Json
          id?: string
          menu_photo_id?: string | null
          raw_ocr_text?: string | null
          restaurant_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_extractions_menu_photo_id_fkey"
            columns: ["menu_photo_id"]
            isOneToOne: false
            referencedRelation: "menu_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_extractions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_reviews: {
        Row: {
          created_at: string
          currency: string
          flavor_intensity_rating: number | null
          id: string
          image_path: string | null
          image_url: string | null
          is_public: boolean
          menu_item_id: string
          price_paid: number | null
          rating: number
          restaurant_id: string | null
          review: string | null
          spiciness_rating: number | null
          sweet_savory_rating: number | null
          tags: string[]
          temperature_rating: number | null
          updated_at: string
          user_id: string
          would_order_again: boolean | null
        }
        Insert: {
          created_at?: string
          currency?: string
          flavor_intensity_rating?: number | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_public?: boolean
          menu_item_id: string
          price_paid?: number | null
          rating: number
          restaurant_id?: string | null
          review?: string | null
          spiciness_rating?: number | null
          sweet_savory_rating?: number | null
          tags?: string[]
          temperature_rating?: number | null
          updated_at?: string
          user_id: string
          would_order_again?: boolean | null
        }
        Update: {
          created_at?: string
          currency?: string
          flavor_intensity_rating?: number | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_public?: boolean
          menu_item_id?: string
          price_paid?: number | null
          rating?: number
          restaurant_id?: string | null
          review?: string | null
          spiciness_rating?: number | null
          sweet_savory_rating?: number | null
          tags?: string[]
          temperature_rating?: number | null
          updated_at?: string
          user_id?: string
          would_order_again?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_reviews_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          aggregate_rating: number
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          cuisine: string | null
          currency: string
          description: string | null
          dietary_tags: string[]
          id: string
          is_published: boolean
          name: string
          normalized_name: string
          photo_count: number
          price_max: number | null
          price_min: number | null
          restaurant_id: string | null
          review_count: number
          section: string | null
          slug: string
          tags: string[]
          typical_price: number | null
          updated_at: string
        }
        Insert: {
          aggregate_rating?: number
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          currency?: string
          description?: string | null
          dietary_tags?: string[]
          id?: string
          is_published?: boolean
          name: string
          normalized_name: string
          photo_count?: number
          price_max?: number | null
          price_min?: number | null
          restaurant_id?: string | null
          review_count?: number
          section?: string | null
          slug: string
          tags?: string[]
          typical_price?: number | null
          updated_at?: string
        }
        Update: {
          aggregate_rating?: number
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          currency?: string
          description?: string | null
          dietary_tags?: string[]
          id?: string
          is_published?: boolean
          name?: string
          normalized_name?: string
          photo_count?: number
          price_max?: number | null
          price_min?: number | null
          restaurant_id?: string | null
          review_count?: number
          section?: string | null
          slug?: string
          tags?: string[]
          typical_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_photos: {
        Row: {
          created_at: string
          id: string
          image_path: string
          image_url: string | null
          ocr_text: string | null
          restaurant_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_path: string
          image_url?: string | null
          ocr_text?: string | null
          restaurant_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string
          image_url?: string | null
          ocr_text?: string | null
          restaurant_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_photos_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "food_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "food_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_saves: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "food_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          dietary_preferences: string[]
          display_name: string
          favorite_cuisines: string[]
          id: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          dietary_preferences?: string[]
          display_name: string
          favorite_cuisines?: string[]
          id?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          dietary_preferences?: string[]
          display_name?: string
          favorite_cuisines?: string[]
          id?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          cuisine: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      refresh_menu_item_rating: {
        Args: { _menu_item_id: string }
        Returns: undefined
      }
      slugify: { Args: { value: string }; Returns: string }
    }
    Enums: {
      post_visibility: "public" | "followers" | "private"
    }
    CompositeTypes: {
      [_ in never]: never
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
      post_visibility: ["public", "followers", "private"],
    },
  },
} as const
