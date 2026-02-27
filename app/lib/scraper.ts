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

// ============================================
// DONANIM ARSİVİ SCRAPER
// ============================================
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
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept-Language": "tr-TR,tr;q=0.9",
        },
      });

      const $ = cheerio.load(response.data);
      const campaignsBeforePage = campaigns.length;

      $(".structItem--thread").each((_, element) => {
        const datetime = $(element)
          .find(".structItem-startDate time")
          .attr("datetime");
        const postDate = datetime ? new Date(datetime) : null;

        const anchor = $(element).find("a[data-tp-primary='on']");
        const title = anchor.text().replace(/\s+/g, " ").trim();
        const link = anchor.attr("href");

        const label = $(element)
          .find(".structItem-title .label")
          .text()
          .trim();
        const isExpired = label.includes("İndirim Bitti");

        if (!title || !link || isExpired) return;
        if (postDate && postDate < oneDayAgo) return;

        campaigns.push({
          title,
          link: link.startsWith("http")
            ? link
            : `https://forum.donanimarsivi.com${link}`,
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

  return campaigns;
}

// ============================================
// DONANIM HABER SCRAPER
// ============================================
export async function scrapeDonanimhaber(): Promise<Campaign[]> {
  const browser = await puppeteer.launch({ headless: true });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    );

    await page.goto(
      "https://forum.donanimhaber.com/sicak-firsatlar--f193",
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );
    await new Promise((r) => setTimeout(r, 3000));

    const campaigns = await page.evaluate(() => {
      const results: { title: string; link: string }[] = [];
      const konular = document.querySelectorAll(".kl-konu");
      konular.forEach((element) => {
        const anchor = element.querySelector("a[href]:has(h3)");
        const title = anchor
          ?.querySelector("h3")
          ?.textContent?.replace(/\s+/g, " ")
          ?.trim();

        const link = anchor?.getAttribute("href");
        if (
          title &&
          link &&
          !link.includes("ad.donanimhaber") &&
          !title.includes("Sponsorlu İçerik") &&
          !title.includes("Sabit Konu")
        ) {
          results.push({ title, link });
        }
      });

      return results;
    });

    return campaigns.map((c) => ({
      title: c.title,
      link: c.link.startsWith("http")
        ? c.link
        : `https://forum.donanimhaber.com${c.link}`,
      source: "donanimhaber",
    }));
  } catch (error) {
    console.error("Donanımhaber hata:", error);
    return [];
  } finally {
    await browser.close();
  }
}

// ============================================
// TECHNOPAT SCRAPER
// ============================================
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
      const headers = document.querySelectorAll("h3.block-header");
      let popularBlock: Element | null = null;
      headers.forEach((header) => {
        if (header.textContent?.includes("Popüler indirimler")) {
          popularBlock = header.closest(".block-container");
        }
      });

      if (!popularBlock) return results;
      const konular = (popularBlock as Element).querySelectorAll(
        ".structItem--thread"
      );

      konular.forEach((element) => {
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

    return campaigns.map((c) => ({
      title: c.title,
      link: c.link.startsWith("http")
        ? c.link
        : `https://www.technopat.net${c.link}`,
      source: "technopat",
      category: c.category,
    }));
  } catch (error) {
    console.error("Technopat hata:", error);
    return [];
  } finally {
    await browser.close();
  }
}

// ============================================
// R10 SCRAPER
// ============================================
export async function scrapeR10(): Promise<Campaign[]> {
  try {
    const response = await axios.get("https://www.r10.net/sicak-firsatlar/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "tr-TR,tr;q=0.9",
      },
      responseType: "arraybuffer",
    });

    const html = iconv.decode(Buffer.from(response.data), "windows-1254");
    const $ = cheerio.load(html);
    const campaigns: Campaign[] = [];

    $("li.thread").each((_, element) => {
      const anchor = $(element).find("a[id^='thread_title_']");
      const title = anchor.find("span").text().trim();
      const link = anchor.attr("href");
      const isSabit = $(element).find(".prefix").text().includes("Sabit");

      if (title && link && !isSabit) {
        campaigns.push({
          title,
          link: link.startsWith("http")
            ? link
            : `https://www.r10.net${link}`,
          source: "r10",
          category: "diger",
        });
      }
    });

    return campaigns;
  } catch (error) {
    console.error("R10 hata:", error);
    return [];
  }
}
