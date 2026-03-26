import puppeteer from "puppeteer";
import { chromium } from "playwright";
import axios from "axios";
import * as cheerio from "cheerio";
import * as iconv from "iconv-lite";

export type Campaign = {
  title: string;
  link: string;
  source: string;
  category?: string;
};

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9",
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function dedupeCampaigns<T extends Campaign>(campaigns: T[]) {
  const seen = new Set<string>();

  return campaigns.filter((campaign) => {
    const key = `${campaign.source}:${campaign.link}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function isLikelyDealTitle(title: string) {
  const normalized = title.toLowerCase();

  return (
    normalized.length >= 12 &&
    !normalized.includes("sabit konu") &&
    !normalized.includes("sponsorlu içerik") &&
    !normalized.includes("sponsorlu icerik") &&
    !normalized.includes("ana konu")
  );
}

function toAbsoluteLink(baseUrl: string, link: string) {
  return link.startsWith("http") ? link : `${baseUrl}${link}`;
}

export async function scrapeDonanimArsivi(): Promise<Campaign[]> {
  const campaigns: Campaign[] = [];
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let page = 1;
  let shouldContinue = true;

  while (shouldContinue) {
    try {
      const url =
        page === 1
          ? "https://forum.donanimarsivi.com/forumlar/Sicakfirsatlar/"
          : `https://forum.donanimarsivi.com/forumlar/Sicakfirsatlar/page-${page}`;

      const response = await axios.get(url, {
        headers: DEFAULT_HEADERS,
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const campaignsBeforePage = campaigns.length;

      $(".structItem--thread").each((_, element) => {
        const datetime = $(element)
          .find(".structItem-startDate time")
          .attr("datetime");
        const postDate = datetime ? new Date(datetime) : null;

        const anchor = $(element).find("a[data-tp-primary='on']");
        const title = normalizeText(anchor.text());
        const link = anchor.attr("href");
        const label = normalizeText(
          $(element).find(".structItem-title .label").text()
        );
        const isExpired = label.includes("İndirim Bitti");

        if (!title || !link || isExpired) return;
        if (postDate && postDate < oneDayAgo) return;

        campaigns.push({
          title,
          link: toAbsoluteLink("https://forum.donanimarsivi.com", link),
          source: "donanimarsivi",
        });
      });

      const foundOnThisPage = campaigns.length - campaignsBeforePage;
      console.log(
        `Donanım Arşivi sayfa ${page}: ${campaigns.length} kampanya (bu sayfadan: ${foundOnThisPage})`
      );

      if (foundOnThisPage === 0 || page >= 10) {
        shouldContinue = false;
      } else {
        page++;
      }
    } catch (error) {
      console.error(`Donanım Arşivi sayfa ${page} hata:`, error);
      shouldContinue = false;
    }
  }

  return dedupeCampaigns(campaigns);
}

function parseDonanimhaberFromHtml(html: string) {
  const $ = cheerio.load(html);
  const campaigns: Campaign[] = [];
  const selectors = [
    ".kl-konu",
    ".topic-list-item",
    ".forumList li",
    "li[data-id]",
    ".boxContent li",
  ];

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const container = $(element);
      const anchors = container.find("a[href]");

      let selectedLink: string | undefined;
      let selectedTitle = "";

      anchors.each((_, anchorEl) => {
        const anchor = $(anchorEl);
        const candidateTitle = normalizeText(
          anchor.find("h3").first().text() ||
            anchor.attr("title") ||
            anchor.text()
        );
        const candidateLink = anchor.attr("href");

        if (!candidateLink || !isLikelyDealTitle(candidateTitle)) {
          return;
        }

        selectedLink = candidateLink;
        selectedTitle = candidateTitle;
        return false;
      });

      if (!selectedLink || !selectedTitle) {
        return;
      }

      if (selectedLink.includes("ad.donanimhaber")) {
        return;
      }

      campaigns.push({
        title: selectedTitle,
        link: toAbsoluteLink("https://forum.donanimhaber.com", selectedLink),
        source: "donanimhaber",
      });
    });

    if (campaigns.length > 0) {
      return dedupeCampaigns(campaigns);
    }
  }

  return [];
}

async function scrapeDonanimhaberWithBrowser(url: string) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(DEFAULT_HEADERS["User-Agent"]);
    page.setDefaultNavigationTimeout(20000);
    page.setDefaultTimeout(20000);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    await page
      .waitForSelector(".kl-konu, a[href]:has(h3), a[href][title]", {
        timeout: 5000,
      })
      .catch(() => null);

    const campaigns = await page.evaluate(() => {
      const results: { title: string; link: string }[] = [];
      const nodes = document.querySelectorAll(
        ".kl-konu, .topic-list-item, .forumList li, li[data-id], .boxContent li"
      );

      nodes.forEach((node) => {
        const anchors = Array.from(node.querySelectorAll("a[href]"));

        for (const anchor of anchors) {
          const rawTitle =
            anchor.querySelector("h3")?.textContent ||
            anchor.getAttribute("title") ||
            anchor.textContent ||
            "";
          const title = rawTitle.replace(/\s+/g, " ").trim();
          const link = anchor.getAttribute("href") || "";
          const normalized = title.toLowerCase();

          if (
            title.length >= 12 &&
            link &&
            !link.includes("ad.donanimhaber") &&
            !normalized.includes("sabit konu") &&
            !normalized.includes("sponsorlu içerik") &&
            !normalized.includes("sponsorlu icerik") &&
            !normalized.includes("ana konu")
          ) {
            results.push({ title, link });
            break;
          }
        }
      });

      return results;
    });

    return dedupeCampaigns(
      campaigns.map((campaign) => ({
        title: campaign.title,
        link: toAbsoluteLink("https://forum.donanimhaber.com", campaign.link),
        source: "donanimhaber",
      }))
    );
  } finally {
    await browser.close();
  }
}

export async function scrapeDonanimhaber(): Promise<Campaign[]> {
  const url = "https://forum.donanimhaber.com/sicak-firsatlar--f193";

  try {
    const response = await axios.get(url, {
      headers: DEFAULT_HEADERS,
      timeout: 15000,
    });
    const campaigns = parseDonanimhaberFromHtml(response.data);

    if (campaigns.length > 0) {
      return campaigns;
    }

    console.warn("DonanımHaber HTTP çekimi sonuç üretmedi, tarayıcı fallback deneniyor.");
  } catch (error) {
    console.warn("DonanımHaber HTTP çekimi başarısız, tarayıcı fallback deneniyor:", error);
  }

  try {
    return await scrapeDonanimhaberWithBrowser(url);
  } catch (error) {
    console.error("DonanımHaber hata:", error);
    return [];
  }
}

export async function scrapeTechnopat(): Promise<Campaign[]> {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "tr-TR",
    });

    const page = await context.newPage();

    await page.goto("https://www.technopat.net/sosyal/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    const campaigns = await page.evaluate(() => {
      const results: { title: string; link: string; category: string }[] = [];
      const headers = Array.from(
        document.querySelectorAll<HTMLElement>("h3.block-header")
      );
      let popularBlock: HTMLElement | null = null;

      headers.forEach((header) => {
        const text = header.textContent?.toLowerCase() ?? "";
        if (text.includes("popüler indirimler") || text.includes("populer indirimler")) {
          popularBlock = header.closest(".block-container") as HTMLElement | null;
        }
      });

      const topics: HTMLElement[] = [];

      if (popularBlock) {
        const block = popularBlock as HTMLElement;
        const matchedTopics = block.querySelectorAll(
          ".structItem--thread"
        ) as NodeListOf<HTMLElement>;
        topics.push(...(Array.from(matchedTopics) as HTMLElement[]));
      }

      topics.forEach((element) => {
        const anchor = element.querySelector("a[data-tp-primary='on']");
        const title = anchor?.textContent?.replace(/\s+/g, " ")?.trim();
        const link = anchor?.getAttribute("href");
        const label = element.querySelector(".label");
        const category = label?.textContent?.trim() || "diger";

        if (title && link) {
          results.push({ title, link, category });
        }
      });

      return results;
    });

    return dedupeCampaigns(
      campaigns.map((campaign) => ({
        title: campaign.title,
        link: toAbsoluteLink("https://www.technopat.net", campaign.link),
        source: "technopat",
        category: campaign.category,
      }))
    );
  } catch (error) {
    console.error("Technopat hata:", error);
    return [];
  } finally {
    await browser.close();
  }
}

export async function scrapeR10(): Promise<Campaign[]> {
  try {
    const response = await axios.get("https://www.r10.net/sicak-firsatlar/", {
      headers: DEFAULT_HEADERS,
      timeout: 15000,
      responseType: "arraybuffer",
    });

    const html = iconv.decode(Buffer.from(response.data), "windows-1254");
    const $ = cheerio.load(html);
    const campaigns: Campaign[] = [];

    $("li.thread").each((_, element) => {
      const anchor = $(element).find("a[id^='thread_title_']");
      const title = normalizeText(anchor.find("span").text());
      const link = anchor.attr("href");
      const isSabit = normalizeText($(element).find(".prefix").text()).includes("Sabit");

      if (title && link && !isSabit) {
        campaigns.push({
          title,
          link: toAbsoluteLink("https://www.r10.net", link),
          source: "r10",
          category: "diger",
        });
      }
    });

    return dedupeCampaigns(campaigns);
  } catch (error) {
    console.error("R10 hata:", error);
    return [];
  }
}
