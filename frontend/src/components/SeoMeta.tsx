import { useEffect } from 'react'

type Keywords = string | string[]

const defaultKeywords: string[] = [
  'POI search',
  'OpenStreetMap',
  'route planning',
  'GPX',
  'points of interest',
  'trip planning',
]

type Props = {
  title: string
  description: string
  url: string
  image?: string
  keywords?: Keywords
  robots?: string
  themeColor?: string
  siteName?: string
  locale?: string
  twitterSite?: string
}

export default function SeoMeta({
  title,
  description,
  url,
  image,
  keywords = defaultKeywords,
  robots = 'index, follow',
  themeColor = '#2563eb',
  siteName = 'WhatsAround',
  locale = 'en_US',
  twitterSite,
}: Props) {
  useEffect(() => {
    const upsertMeta = (selector: string, attrs: Record<string, string>) => {
      let element = document.head.querySelector(selector) as HTMLMetaElement | null
      if (!element) {
        element = document.createElement('meta')
        document.head.appendChild(element)
      }
      Object.entries(attrs).forEach(([key, value]) => {
        element?.setAttribute(key, value)
      })
    }

    const removeMeta = (selector: string) => {
      const element = document.head.querySelector(selector)
      if (element) {
        element.remove()
      }
    }

    const upsertLink = (selector: string, attrs: Record<string, string>) => {
      let element = document.head.querySelector(selector) as HTMLLinkElement | null
      if (!element) {
        element = document.createElement('link')
        document.head.appendChild(element)
      }
      Object.entries(attrs).forEach(([key, value]) => {
        element?.setAttribute(key, value)
      })
    }

    const keywordContent = Array.isArray(keywords) ? keywords.join(', ') : keywords

    document.title = title

    upsertMeta('meta[name="description"]', {
      name: 'description',
      content: description,
    })

    if (keywordContent && keywordContent.trim().length > 0) {
      upsertMeta('meta[name="keywords"]', {
        name: 'keywords',
        content: keywordContent,
      })
    } else {
      removeMeta('meta[name="keywords"]')
    }

    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: robots,
    })

    upsertMeta('meta[name="theme-color"]', {
      name: 'theme-color',
      content: themeColor,
    })

    upsertLink('link[rel="canonical"]', {
      rel: 'canonical',
      href: url,
    })

    upsertMeta('meta[property="og:title"]', {
      property: 'og:title',
      content: title,
    })
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: description,
    })
    upsertMeta('meta[property="og:type"]', {
      property: 'og:type',
      content: 'website',
    })
    upsertMeta('meta[property="og:site_name"]', {
      property: 'og:site_name',
      content: siteName,
    })
    upsertMeta('meta[property="og:locale"]', {
      property: 'og:locale',
      content: locale,
    })
    upsertMeta('meta[property="og:url"]', {
      property: 'og:url',
      content: url,
    })
    if (image) {
      upsertMeta('meta[property="og:image"]', {
        property: 'og:image',
        content: image,
      })
    } else {
      removeMeta('meta[property="og:image"]')
    }

    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: 'summary_large_image',
    })
    upsertMeta('meta[name="twitter:title"]', {
      name: 'twitter:title',
      content: title,
    })
    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: description,
    })
    if (twitterSite) {
      upsertMeta('meta[name="twitter:site"]', {
        name: 'twitter:site',
        content: twitterSite,
      })
    } else {
      removeMeta('meta[name="twitter:site"]')
    }
    if (image) {
      upsertMeta('meta[name="twitter:image"]', {
        name: 'twitter:image',
        content: image,
      })
    } else {
      removeMeta('meta[name="twitter:image"]')
    }
  }, [
    title,
    description,
    url,
    image,
    keywords,
    robots,
    themeColor,
    siteName,
    locale,
    twitterSite,
  ])

  return null
}
