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
      collection_dishes: {
        Row: {
          collection_id: string
          created_at: string
          dish_id: string
          id: string
          note: string | null
          sort_order: number
        }
        Insert: {
          collection_id: string
          created_at?: string
          dish_id: string
          id?: string
          note?: string | null
          sort_order?: number
        }
        Update: {
          collection_id?: string
          created_at?: string
          dish_id?: string
          id?: string
          note?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_dishes_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_dishes_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dish_ai_recognitions: {
        Row: {
          confidence: number | null
          confidence_level: string
          created_at: string
          cuisine: string | null
          dish_id: string | null
          dish_name: string | null
          error: string | null
          id: string
          image_hash: string
          ingredients: string[]
          photo_id: string | null
          raw_result: Json
          status: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          confidence_level?: string
          created_at?: string
          cuisine?: string | null
          dish_id?: string | null
          dish_name?: string | null
          error?: string | null
          id?: string
          image_hash: string
          ingredients?: string[]
          photo_id?: string | null
          raw_result?: Json
          status?: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          confidence_level?: string
          created_at?: string
          cuisine?: string | null
          dish_id?: string | null
          dish_name?: string | null
          error?: string | null
          id?: string
          image_hash?: string
          ingredients?: string[]
          photo_id?: string | null
          raw_result?: Json
          status?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dish_share_events: {
        Row: {
          created_at: string
          dish_id: string
          id: string
          share_channel: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dish_id: string
          id?: string
          share_channel?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dish_id?: string
          id?: string
          share_channel?: string
          user_id?: string | null
        }
        Relationships: []
      }
      dish_sponsorships: {
        Row: {
          boost_score: number
          created_at: string
          dish_id: string
          ends_at: string | null
          id: string
          is_active: boolean
          label: string
          sponsor_name: string | null
          starts_at: string
          target_city: string | null
          target_cuisine: string | null
          updated_at: string
        }
        Insert: {
          boost_score?: number
          created_at?: string
          dish_id: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sponsor_name?: string | null
          starts_at?: string
          target_city?: string | null
          target_cuisine?: string | null
          updated_at?: string
        }
        Update: {
          boost_score?: number
          created_at?: string
          dish_id?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sponsor_name?: string | null
          starts_at?: string
          target_city?: string | null
          target_cuisine?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dish_tags: {
        Row: {
          created_at: string
          created_by: string | null
          dish_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dish_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dish_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_tags_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      dish_trend_metrics: {
        Row: {
          dish_id: string
          favorite_velocity: number
          is_hot_nearby: boolean
          location_spike_score: number
          previous_favorite_count: number
          previous_rating_count: number
          previous_review_count: number
          previous_save_count: number
          previous_share_count: number
          rating_velocity: number
          recent_favorite_count: number
          recent_rating_count: number
          recent_review_count: number
          recent_save_count: number
          recent_share_count: number
          review_velocity: number
          save_velocity: number
          share_velocity: number
          spike_score: number
          status: string
          trend_score: number
          updated_at: string
          window_ended_at: string
          window_started_at: string
        }
        Insert: {
          dish_id: string
          favorite_velocity?: number
          is_hot_nearby?: boolean
          location_spike_score?: number
          previous_favorite_count?: number
          previous_rating_count?: number
          previous_review_count?: number
          previous_save_count?: number
          previous_share_count?: number
          rating_velocity?: number
          recent_favorite_count?: number
          recent_rating_count?: number
          recent_review_count?: number
          recent_save_count?: number
          recent_share_count?: number
          review_velocity?: number
          save_velocity?: number
          share_velocity?: number
          spike_score?: number
          status?: string
          trend_score?: number
          updated_at?: string
          window_ended_at?: string
          window_started_at: string
        }
        Update: {
          dish_id?: string
          favorite_velocity?: number
          is_hot_nearby?: boolean
          location_spike_score?: number
          previous_favorite_count?: number
          previous_rating_count?: number
          previous_review_count?: number
          previous_save_count?: number
          previous_share_count?: number
          rating_velocity?: number
          recent_favorite_count?: number
          recent_rating_count?: number
          recent_review_count?: number
          recent_save_count?: number
          recent_share_count?: number
          review_velocity?: number
          save_velocity?: number
          share_velocity?: number
          spike_score?: number
          status?: string
          trend_score?: number
          updated_at?: string
          window_ended_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      dish_trend_snapshots: {
        Row: {
          created_at: string
          dish_id: string
          favorite_velocity: number
          id: string
          is_hot_nearby: boolean
          location_spike_score: number
          rating_velocity: number
          recent_favorite_count: number
          recent_rating_count: number
          recent_review_count: number
          recent_save_count: number
          recent_share_count: number
          review_velocity: number
          save_velocity: number
          share_velocity: number
          spike_score: number
          status: string
          trend_score: number
          window_ended_at: string
          window_started_at: string
        }
        Insert: {
          created_at?: string
          dish_id: string
          favorite_velocity?: number
          id?: string
          is_hot_nearby?: boolean
          location_spike_score?: number
          rating_velocity?: number
          recent_favorite_count?: number
          recent_rating_count?: number
          recent_review_count?: number
          recent_save_count?: number
          recent_share_count?: number
          review_velocity?: number
          save_velocity?: number
          share_velocity?: number
          spike_score?: number
          status?: string
          trend_score?: number
          window_ended_at?: string
          window_started_at: string
        }
        Update: {
          created_at?: string
          dish_id?: string
          favorite_velocity?: number
          id?: string
          is_hot_nearby?: boolean
          location_spike_score?: number
          rating_velocity?: number
          recent_favorite_count?: number
          recent_rating_count?: number
          recent_review_count?: number
          recent_save_count?: number
          recent_share_count?: number
          review_velocity?: number
          save_velocity?: number
          share_velocity?: number
          spike_score?: number
          status?: string
          trend_score?: number
          window_ended_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      dishes: {
        Row: {
          aggregate_rating: number
          boost_ends_at: string | null
          boost_score: number
          boost_starts_at: string | null
          cover_photo_id: string | null
          created_at: string
          created_by: string | null
          cuisine: string | null
          currency: string
          description: string | null
          favorite_count: number
          id: string
          is_published: boolean
          like_count: number
          name: string
          normalized_name: string
          photo_count: number
          price_max: number | null
          price_min: number | null
          rating_count: number
          restaurant_id: string | null
          review_count: number
          save_count: number
          search_vector: unknown
          section: string | null
          slug: string
          trending_score: number
          typical_price: number | null
          updated_at: string
          want_to_try_count: number
        }
        Insert: {
          aggregate_rating?: number
          boost_ends_at?: string | null
          boost_score?: number
          boost_starts_at?: string | null
          cover_photo_id?: string | null
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          currency?: string
          description?: string | null
          favorite_count?: number
          id?: string
          is_published?: boolean
          like_count?: number
          name: string
          normalized_name: string
          photo_count?: number
          price_max?: number | null
          price_min?: number | null
          rating_count?: number
          restaurant_id?: string | null
          review_count?: number
          save_count?: number
          search_vector?: unknown
          section?: string | null
          slug: string
          trending_score?: number
          typical_price?: number | null
          updated_at?: string
          want_to_try_count?: number
        }
        Update: {
          aggregate_rating?: number
          boost_ends_at?: string | null
          boost_score?: number
          boost_starts_at?: string | null
          cover_photo_id?: string | null
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          currency?: string
          description?: string | null
          favorite_count?: number
          id?: string
          is_published?: boolean
          like_count?: number
          name?: string
          normalized_name?: string
          photo_count?: number
          price_max?: number | null
          price_min?: number | null
          rating_count?: number
          restaurant_id?: string | null
          review_count?: number
          save_count?: number
          search_vector?: unknown
          section?: string | null
          slug?: string
          trending_score?: number
          typical_price?: number | null
          updated_at?: string
          want_to_try_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "dishes_cover_photo_fk"
            columns: ["cover_photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dishes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dishes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_list_items: {
        Row: {
          created_at: string
          dish_id: string | null
          id: string
          list_id: string
          menu_item_id: string | null
          note: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          dish_id?: string | null
          id?: string
          list_id: string
          menu_item_id?: string | null
          note?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          dish_id?: string | null
          id?: string
          list_id?: string
          menu_item_id?: string | null
          note?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "favorite_list_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
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
        Relationships: [
          {
            foreignKeyName: "favorite_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      photos: {
        Row: {
          ai_confidence: number | null
          ai_cuisine: string | null
          ai_dish_name: string | null
          ai_error: string | null
          ai_ingredients: string[]
          ai_status: string
          ai_tags: string[]
          alt_text: string | null
          created_at: string
          dish_id: string
          height: number | null
          id: string
          image_hash: string | null
          image_url: string | null
          is_public: boolean
          review_id: string | null
          storage_bucket: string
          storage_path: string | null
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_cuisine?: string | null
          ai_dish_name?: string | null
          ai_error?: string | null
          ai_ingredients?: string[]
          ai_status?: string
          ai_tags?: string[]
          alt_text?: string | null
          created_at?: string
          dish_id: string
          height?: number | null
          id?: string
          image_hash?: string | null
          image_url?: string | null
          is_public?: boolean
          review_id?: string | null
          storage_bucket?: string
          storage_path?: string | null
          updated_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          ai_confidence?: number | null
          ai_cuisine?: string | null
          ai_dish_name?: string | null
          ai_error?: string | null
          ai_ingredients?: string[]
          ai_status?: string
          ai_tags?: string[]
          alt_text?: string | null
          created_at?: string
          dish_id?: string
          height?: number | null
          id?: string
          image_hash?: string | null
          image_url?: string | null
          is_public?: boolean
          review_id?: string | null
          storage_bucket?: string
          storage_path?: string | null
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_review_fk"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      ratings: {
        Row: {
          created_at: string
          dish_id: string
          flavor_intensity_rating: number | null
          id: string
          is_public: boolean
          rating: number
          spiciness_rating: number | null
          sweet_savory_rating: number | null
          temperature_rating: number | null
          updated_at: string
          user_id: string
          would_order_again: boolean | null
        }
        Insert: {
          created_at?: string
          dish_id: string
          flavor_intensity_rating?: number | null
          id?: string
          is_public?: boolean
          rating: number
          spiciness_rating?: number | null
          sweet_savory_rating?: number | null
          temperature_rating?: number | null
          updated_at?: string
          user_id: string
          would_order_again?: boolean | null
        }
        Update: {
          created_at?: string
          dish_id?: string
          flavor_intensity_rating?: number | null
          id?: string
          is_public?: boolean
          rating?: number
          spiciness_rating?: number | null
          sweet_savory_rating?: number | null
          temperature_rating?: number | null
          updated_at?: string
          user_id?: string
          would_order_again?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_boost_requests: {
        Row: {
          budget_cents: number | null
          claim_id: string | null
          created_at: string
          dish_id: string
          ends_at: string | null
          id: string
          note: string | null
          requested_boost_score: number
          restaurant_id: string | null
          starts_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_cents?: number | null
          claim_id?: string | null
          created_at?: string
          dish_id: string
          ends_at?: string | null
          id?: string
          note?: string | null
          requested_boost_score?: number
          restaurant_id?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_cents?: number | null
          claim_id?: string | null
          created_at?: string
          dish_id?: string
          ends_at?: string | null
          id?: string
          note?: string | null
          requested_boost_score?: number
          restaurant_id?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      restaurant_claims: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string
          id: string
          restaurant_id: string | null
          restaurant_name: string
          reviewed_at: string | null
          status: string
          updated_at: string
          user_id: string
          verification_note: string | null
          website_url: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          restaurant_id?: string | null
          restaurant_name: string
          reviewed_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verification_note?: string | null
          website_url?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          restaurant_id?: string | null
          restaurant_name?: string
          reviewed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verification_note?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      restaurant_dish_submissions: {
        Row: {
          claim_id: string | null
          created_at: string
          cuisine: string | null
          description: string | null
          dish_id: string | null
          dish_name: string
          id: string
          note: string | null
          restaurant_id: string | null
          status: string
          typical_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          claim_id?: string | null
          created_at?: string
          cuisine?: string | null
          description?: string | null
          dish_id?: string | null
          dish_name: string
          id?: string
          note?: string | null
          restaurant_id?: string | null
          status?: string
          typical_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          claim_id?: string | null
          created_at?: string
          cuisine?: string | null
          description?: string | null
          dish_id?: string | null
          dish_name?: string
          id?: string
          note?: string | null
          restaurant_id?: string | null
          status?: string
          typical_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      restaurant_official_photos: {
        Row: {
          caption: string | null
          claim_id: string | null
          created_at: string
          dish_id: string
          id: string
          image_url: string | null
          restaurant_id: string | null
          status: string
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          claim_id?: string | null
          created_at?: string
          dish_id: string
          id?: string
          image_url?: string | null
          restaurant_id?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          claim_id?: string | null
          created_at?: string
          dish_id?: string
          id?: string
          image_url?: string | null
          restaurant_id?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          address: string | null
          business_status: string | null
          city: string | null
          created_at: string
          created_by: string | null
          cuisine: string | null
          email: string | null
          google_place_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          maps_url: string | null
          name: string
          normalized_name: string | null
          phone: string | null
          photo_reference: string | null
          price_level: number | null
          rating: number | null
          review_count: number | null
          search_vector: unknown
          slug: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          business_status?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          email?: string | null
          google_place_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          maps_url?: string | null
          name: string
          normalized_name?: string | null
          phone?: string | null
          photo_reference?: string | null
          price_level?: number | null
          rating?: number | null
          review_count?: number | null
          search_vector?: unknown
          slug?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          business_status?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          email?: string | null
          google_place_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          maps_url?: string | null
          name?: string
          normalized_name?: string | null
          phone?: string | null
          photo_reference?: string | null
          price_level?: number | null
          rating?: number | null
          review_count?: number | null
          search_vector?: unknown
          slug?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurants_created_by_users_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          currency: string
          dish_id: string
          id: string
          is_public: boolean
          price_paid: number | null
          rating_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          currency?: string
          dish_id: string
          id?: string
          is_public?: boolean
          price_paid?: number | null
          rating_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          currency?: string
          dish_id?: string
          id?: string
          is_public?: boolean
          price_paid?: number | null
          rating_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_rating_id_fkey"
            columns: ["rating_id"]
            isOneToOne: false
            referencedRelation: "ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_items: {
        Row: {
          action_type: Database["public"]["Enums"]["saved_item_type"]
          created_at: string
          dish_id: string
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type?: Database["public"]["Enums"]["saved_item_type"]
          created_at?: string
          dish_id: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["saved_item_type"]
          created_at?: string
          dish_id?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          dietary_preferences: string[]
          display_name: string | null
          email: string | null
          favorite_cuisines: string[]
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          dietary_preferences?: string[]
          display_name?: string | null
          email?: string | null
          favorite_cuisines?: string[]
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          dietary_preferences?: string[]
          display_name?: string | null
          email?: string | null
          favorite_cuisines?: string[]
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_current_user_profile: {
        Args: never
        Returns: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          dietary_preferences: string[]
          display_name: string | null
          email: string | null
          favorite_cuisines: string[]
          id: string
          updated_at: string
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_dish_rollups: { Args: { _dish_id: string }; Returns: undefined }
      refresh_dish_trend_metrics: {
        Args: { _dish_id: string }
        Returns: {
          dish_id: string
          favorite_velocity: number
          is_hot_nearby: boolean
          location_spike_score: number
          previous_favorite_count: number
          previous_rating_count: number
          previous_review_count: number
          previous_save_count: number
          previous_share_count: number
          rating_velocity: number
          recent_favorite_count: number
          recent_rating_count: number
          recent_review_count: number
          recent_save_count: number
          recent_share_count: number
          review_velocity: number
          save_velocity: number
          share_velocity: number
          spike_score: number
          status: string
          trend_score: number
          updated_at: string
          window_ended_at: string
          window_started_at: string
        }
        SetofOptions: {
          from: "*"
          to: "dish_trend_metrics"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_menu_item_rating: {
        Args: { _menu_item_id: string }
        Returns: undefined
      }
      slugify: { Args: { value: string }; Returns: string }
      user_has_approved_restaurant_claim: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      post_visibility: "public" | "followers" | "private"
      saved_item_type: "saved" | "want_to_try" | "tried" | "liked" | "favorite"
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
      saved_item_type: ["saved", "want_to_try", "tried", "liked", "favorite"],
    },
  },
} as const
