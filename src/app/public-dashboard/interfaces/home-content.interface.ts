/** A text field that may be a plain string (legacy) or a per-language map */
export type I18nStr = string | Record<string, string>;

export interface PublicHomeMetric {
  label: I18nStr;
  value: string;       // numeric values stay plain
  caption?: I18nStr;
}

export interface PublicHomeMediaItem {
  id: string;
  type: 'image' | 'video';
  title: I18nStr;
  description: I18nStr;
  url: string;
  poster?: string;
  ctaLabel?: I18nStr;
  ctaHref?: string;
}

export interface PublicHomeContent {
  id?: string;
  slug: string;
  active: boolean;
  navbar: {
    brandName: I18nStr;
    brandAccent?: I18nStr;
  };
  hero: {
    badge: I18nStr;
    title: I18nStr;
    accentText?: I18nStr;
    description: I18nStr;
    primaryCtaLabel: I18nStr;
    primaryCtaRoute: string;
    secondaryCtaLabel: I18nStr;
    secondaryCtaHref: string;
    highlights: I18nStr[];
    panelLabel: I18nStr;
    panelStatus: I18nStr;
    metrics: PublicHomeMetric[];
  };
  mediaShowcase: {
    title: I18nStr;
    description: I18nStr;
    items: PublicHomeMediaItem[];
  };
  stats: Array<{
    value: string;
    label: I18nStr;
  }>;
  advantages: {
    eyebrow: I18nStr;
    title: I18nStr;
    description: I18nStr;
    items: Array<{
      id: string;
      title: I18nStr;
      description: I18nStr;
    }>;
  };
  howItWorks: {
    eyebrow: I18nStr;
    title: I18nStr;
    description: I18nStr;
    steps: Array<{
      id: string;
      title: I18nStr;
      description: I18nStr;
    }>;
  };
  cta: {
    title: I18nStr;
    description: I18nStr;
    primaryLabel: I18nStr;
    primaryRoute: string;
    secondaryLabel: I18nStr;
    secondaryHref: string;
    note: I18nStr;
  };
  footer: {
    brandName: I18nStr;
    brandSuffix?: I18nStr;
    description: I18nStr;
    bottomText: I18nStr;
  };
}
