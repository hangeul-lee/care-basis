import { newsSources } from "./seedData.js";
import { isTrustedSourceUrl } from "./trustedSources.js";
import { normalizeTags } from "./utils.js";

const allowedMediaHosts = ["yna.co.kr", "news.sbs.co.kr"];

const childContextKeywords = [
  "영유아",
  "영아",
  "유아",
  "신생아",
  "아기",
  "아동",
  "어린이",
  "소아",
  "미성년",
  "미취학",
  "어린이집",
  "유치원",
  "보육",
  "양육",
  "육아",
  "분유",
  "이유식",
  "기저귀"
];

const newsCategoryRules = [
  {
    category: "사고/안전",
    keywords: [
      "사고",
      "안전",
      "학대",
      "방치",
      "사망",
      "중상",
      "화재",
      "추락",
      "질식",
      "익사",
      "교통사고",
      "통학버스",
      "실종",
      "유괴",
      "식중독",
      "리콜",
      "회수",
      "경찰",
      "소방"
    ]
  },
  {
    category: "보육/어린이집",
    keywords: ["어린이집", "유치원", "보육교사", "보육", "누리과정", "등원", "하원"]
  },
  {
    category: "복지/정책",
    keywords: [
      "부모급여",
      "아동수당",
      "보육료",
      "육아휴직",
      "아이돌봄",
      "돌봄",
      "지원",
      "복지",
      "정책",
      "저출생",
      "출산",
      "양육",
      "유보통합",
      "보육"
    ]
  },
  {
    category: "건강/감염",
    keywords: [
      "예방접종",
      "백일해",
      "RSV",
      "수족구",
      "독감",
      "인플루엔자",
      "감염",
      "발열",
      "응급",
      "소아",
      "질병",
      "병원",
      "분유",
      "이유식",
      "식품"
    ]
  }
];

const topicKeywords = Array.from(new Set(newsCategoryRules.flatMap((rule) => rule.keywords)));
const standaloneParentingKeywords = [
  "부모급여",
  "아동수당",
  "보육료",
  "육아휴직",
  "아이돌봄",
  "부모교육",
  "유보통합",
  "누리과정",
  "어린이집",
  "유치원",
  "보육교사",
  "보육시설",
  "영유아검진",
  "영유아 건강검진",
  "예방접종",
  "백일해",
  "RSV",
  "수족구",
  "아동학대",
  "소아진료",
  "분만",
  "분유",
  "이유식",
  "기저귀",
  "키즈카페",
  "카시트",
  "장난감"
];

let newsCache = {
  updatedAt: 0,
  errors: [],
  fetchedCount: 0,
  savedCount: 0,
  items: []
};

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&middot;/g, "·")
    .replace(/&hellip;/g, "…")
    .replace(/&rarr;/g, "→")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rsquo;/g, "’")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getTag(block, tag) {
  const escapedTag = tag.replace(":", "\\:");
  const match = block.match(new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  try {
    return new URL(trimmed).href;
  } catch {
    return trimmed;
  }
}

function parseDate(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : "";
}

function hasAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function isAllowedMediaUrl(value) {
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, "");
    return allowedMediaHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function isAllowedNewsUrl(value) {
  return isTrustedSourceUrl(value) || isAllowedMediaUrl(value);
}

function categorize(text) {
  const matchedRule = newsCategoryRules.find((rule) => hasAny(text, rule.keywords));
  return matchedRule ? matchedRule.category : "생활/돌봄";
}

function tagsFor(text, category, sourceInstitution) {
  const matchedTags = [
    category,
    sourceInstitution,
    ...childContextKeywords.filter((keyword) => text.includes(keyword)).slice(0, 4),
    ...topicKeywords.filter((keyword) => text.includes(keyword)).slice(0, 4)
  ];
  return normalizeTags(matchedTags);
}

function relevant(item) {
  if (!item.title || !item.sourceUrl || !isAllowedNewsUrl(item.sourceUrl)) return false;

  const title = item.title;
  const text = `${item.title} ${item.summary}`;
  const titleHasChildContext = hasAny(title, childContextKeywords);
  const titleHasStandaloneTopic = hasAny(title, standaloneParentingKeywords);
  const hasTopic = hasAny(text, topicKeywords);

  return titleHasStandaloneTopic || (titleHasChildContext && hasTopic);
}

function parseRss(xml, source) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  return blocks
    .map((block) => {
      const title = getTag(block, "title");
      const sourceUrl = normalizeUrl(getTag(block, "link") || getTag(block, "guid"));
      const summary = getTag(block, "description").slice(0, 180);
      const publishedAt = parseDate(getTag(block, "pubDate") || getTag(block, "dc:date"));
      const text = `${title} ${summary}`;
      const category = categorize(text);

      return {
        title,
        summary,
        sourceInstitution: source.sourceInstitution,
        sourceUrl,
        publishedAt,
        category,
        trustGrade: source.trustGrade || (source.sourceType === "media" ? "A" : "A+"),
        tags: tagsFor(text, category, source.sourceInstitution)
      };
    })
    .filter((item) => relevant(item, source));
}

function normalizeTitle(value) {
  return String(value || "")
    .replace(/[“”"'‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeNewsArticles(items) {
  const byUrl = new Map();
  const titleSet = new Set();
  const unique = [];

  items.forEach((item) => {
    const normalizedTitle = normalizeTitle(item.title);
    if (byUrl.has(item.sourceUrl) || titleSet.has(normalizedTitle)) return;

    byUrl.set(item.sourceUrl, item);
    titleSet.add(normalizedTitle);
    unique.push(item);
  });

  return unique;
}

function sortNews(items) {
  return [...items].sort((a, b) => {
    const dateCompare = String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""));
    if (dateCompare !== 0) return dateCompare;
    return String(b.archivedAt || "").localeCompare(String(a.archivedAt || ""));
  });
}

function filterNews(items, { category = "", query = "" } = {}) {
  const normalizedCategory = category.trim();
  const normalizedQuery = query.trim().toLowerCase();

  return sortNews(dedupeNewsArticles(items))
    .filter((item) => {
      const matchesCategory = !normalizedCategory || normalizedCategory === "전체" || item.category === normalizedCategory;
      const haystack = [
        item.title,
        item.summary,
        item.sourceInstitution,
        item.category,
        ...(item.tags || [])
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    })
    .slice(0, 120);
}

async function collectNewsFromFeeds() {
  const settled = await Promise.allSettled(
    newsSources.map(async (source) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6500);

      try {
        const response = await fetch(source.sourceUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        return parseRss(await response.text(), source);
      } finally {
        clearTimeout(timeout);
      }
    })
  );

  const errors = [];
  const items = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return result.value;

    errors.push({
      sourceInstitution: newsSources[index]?.sourceInstitution || "알 수 없음",
      message: result.reason?.message || "RSS 수집 실패"
    });
    return [];
  });

  return { items: dedupeNewsArticles(items), errors };
}

async function refreshNewsArchive(store) {
  const tenMinutes = 10 * 60 * 1000;
  if (Date.now() - newsCache.updatedAt < tenMinutes) {
    return newsCache;
  }

  const { items, errors } = await collectNewsFromFeeds();
  let savedCount = 0;

  if (store?.archiveNewsArticles) {
    const result = await store.archiveNewsArticles(items);
    savedCount = result?.savedCount ?? items.length;
  }

  newsCache = {
    updatedAt: Date.now(),
    errors,
    fetchedCount: items.length,
    savedCount,
    items: sortNews(items)
  };

  return newsCache;
}

export async function fetchParentingNews(store, options = {}) {
  const refreshed = await refreshNewsArchive(store);
  const updatedAt = refreshed.updatedAt ? new Date(refreshed.updatedAt).toISOString() : "";

  if (store?.listNewsArticles) {
    const archivedItems = await store.listNewsArticles({});
    const items = filterNews(archivedItems.filter((item) => relevant(item)), options);
    return {
      items,
      updatedAt,
      sourceCount: newsSources.length,
      fetchedCount: refreshed.fetchedCount,
      savedCount: refreshed.savedCount,
      errors: refreshed.errors
    };
  }

  return {
    items: filterNews(refreshed.items, options),
    updatedAt,
    sourceCount: newsSources.length,
    fetchedCount: refreshed.fetchedCount,
    savedCount: refreshed.savedCount,
    errors: refreshed.errors
  };
}
