export type SocialKey = 'facebook' | 'instagram' | 'whatsapp';
export type SectionId = 'story' | 'services' | 'articles' | 'gallery' | 'videos' | 'contact';
export type Accent = 'gold' | 'champagne' | 'rose';

export interface SectionCfg {
  id: SectionId;
  title: string;
  description: string;
  visible: boolean;
}
export interface ServiceItem {
  title: string;
  text: string;
}
export interface SiteSettings {
  site_name: string;
  slogan: string;
  logo_path: string | null;
  hero_image_path: string | null;
  hero_headline: string;
  hero_intro: string;
  phone: string;
  address: string;
  social: {
    facebook: { url: string; enabled: boolean };
    instagram: { url: string; enabled: boolean };
    whatsapp: { url: string; phone: string; enabled: boolean };
  };
  social_order: SocialKey[];
  footer_text: string;
  seo_title: string;
  seo_description: string;
  accent: Accent;
  sections: SectionCfg[];
  services: ServiceItem[];
}

export interface Article {
  id: string;
  kind: 'article' | 'biography';
  slug: string;
  title: string;
  subtitle: string | null;
  body: string;
  cover_path: string | null;
  images: string[];
  video_url: string | null;
  video_path: string | null;
  status: 'draft' | 'published';
  featured: boolean;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  title: string | null;
  description: string | null;
  storage_path: string | null;
  external_url: string | null;
  thumb_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  is_published: boolean;
  featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type Bucket = 'branding' | 'articles' | 'gallery' | 'videos';
