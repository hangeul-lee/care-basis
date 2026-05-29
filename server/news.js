import { newsSources } from "./seedData.js";
import { isTrustedSourceUrl } from "./trustedSources.js";

const directNewsKeywords = [
  "영유아",
  "유아",
  "어린이",
  "아동",
  "육아",
  "보육",
  "어린이집",
  "소아",
  "부모",
  "급식",
  "발달"
];

const healthNewsKeywords = [
  "예방접종",
  "수족구",
  "독감",
  "인플루엔자",
  "백일해",
  "호흡기",
  "RSV"
];

let newsCache = {
  updatedAt: 0,
  items: []
};

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
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
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function parseRss(xml, sourceInstitution) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  return blocks.map((block) => {
    const title = getTag(block, "title");
    const link = getTag(block, "link");
    const summary = getTag(block, "description");
    const pubDate = getTag(block, "pubDate") || getTag(block, "dc:date");
    const publishedAt = pubDate ? new Date(pubDate) : null;

    return {
      title,
      summary: summary.slice(0, 180),
      sourceInstitution,
      sourceUrl: link,
      publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime())
        ? publishedAt.toISOString().slice(0, 10)
        : "",
      trustGrade: "A+"
    };
  });
}

function relevant(item) {
  const text = `${item.title} ${item.summary}`;
  if (!isTrustedSourceUrl(item.sourceUrl)) return false;

  if (directNewsKeywords.some((keyword) => text.includes(keyword))) return true;

  const hasChildContext = /영유아|어린이|아동|소아/.test(text);
  const hasHealthTopic = healthNewsKeywords.some((keyword) => text.includes(keyword));
  return hasChildContext && hasHealthTopic;
}

export async function fetchParentingNews() {
  const tenMinutes = 10 * 60 * 1000;
  if (Date.now() - newsCache.updatedAt < tenMinutes) {
    return newsCache.items;
  }

  const settled = await Promise.allSettled(
    newsSources.map(async (source) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(source.sourceUrl, { signal: controller.signal });
        if (!response.ok) return [];
        return parseRss(await response.text(), source.sourceInstitution);
      } finally {
        clearTimeout(timeout);
      }
    })
  );

  const items = settled
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter(relevant)
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
    .slice(0, 24);

  newsCache = {
    updatedAt: Date.now(),
    items
  };

  return items;
}
