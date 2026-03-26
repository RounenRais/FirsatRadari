import { NextResponse } from "next/server";
import {
  scrapeDonanimArsivi,
  scrapeDonanimhaber,
  scrapeTechnopat,
  scrapeR10,
} from "../lib/scraper";
import { analyzeCampaigns } from "../lib/analyze";
import { createServerClient } from "../lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type SourceResult = {
  source: string;
  campaigns: Awaited<ReturnType<typeof scrapeDonanimArsivi>>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSourceWithTimeout(
  source: string,
  scraper: () => Promise<SourceResult["campaigns"]>,
  timeoutMs: number
): Promise<SourceResult> {
  try {
    const campaigns = await Promise.race([
      scraper(),
      new Promise<SourceResult["campaigns"]>((_, reject) =>
        setTimeout(() => reject(new Error(`${source} timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);

    return { source, campaigns };
  } catch (error) {
    console.error(`${source} hatası:`, error);
    return { source, campaigns: [] };
  }
}

async function saveCampaignsWithRetry(
  rows: Array<{
    title: string;
    link: string;
    source: string;
    category?: string;
  }>
) {
  const supabase = createServerClient();
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .upsert(rows, { onConflict: "link", ignoreDuplicates: true })
        .select();

      if (error) {
        lastError = error;
      } else {
        return { savedCount: data?.length ?? 0, error: null };
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < 3) {
      await sleep(attempt * 1000);
    }
  }

  return { savedCount: 0, error: lastError };
}

export async function GET() {
  try {
    console.log("Scraping başlıyor...");

    const sourceResults = await Promise.all([
      runSourceWithTimeout("donanimarsivi", scrapeDonanimArsivi, 20000),
      runSourceWithTimeout("donanimhaber", scrapeDonanimhaber, 25000),
      runSourceWithTimeout("technopat", scrapeTechnopat, 20000),
      runSourceWithTimeout("r10", scrapeR10, 20000),
    ]);

    const allCampaigns = sourceResults.flatMap((result) => {
      console.log(`${result.source}: ${result.campaigns.length} kampanya bulundu`);
      return result.campaigns;
    });

    console.log(`Toplam ${allCampaigns.length} kampanya bulundu, analiz ediliyor...`);

    const validCampaigns = await analyzeCampaigns(allCampaigns);
    console.log(`${validCampaigns.length} geçerli kampanya bulundu`);

    let savedCount = 0;
    let warning: string | undefined;

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      warning =
        "SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY tanımlı değil, veritabanına kaydedilmedi.";
    } else if (validCampaigns.length > 0) {
      const rows = validCampaigns.map((campaign) => ({
        title: campaign.title,
        link: campaign.link,
        source: campaign.source,
        category: campaign.category,
      }));

      const saveResult = await saveCampaignsWithRetry(rows);

      if (saveResult.error) {
        console.error("Supabase kayıt hatası:", saveResult.error);
        warning =
          "Kampanyalar işlendi ama Supabase'e kaydedilemedi. DNS veya ağ erişimini kontrol edin.";
      } else {
        savedCount = saveResult.savedCount;
      }
    }

    return NextResponse.json({
      success: true,
      scraped: allCampaigns.length,
      valid: validCampaigns.length,
      saved: savedCount,
      warning,
      campaigns: validCampaigns,
      sources: {
        donanimarsivi: sourceResults[0].campaigns.length,
        donanimhaber: sourceResults[1].campaigns.length,
        technopat: sourceResults[2].campaigns.length,
        r10: sourceResults[3].campaigns.length,
      },
    });
  } catch (error) {
    console.error("API hatası:", error);
    return NextResponse.json(
      { success: false, error: "Bir hata oluştu" },
      { status: 500 }
    );
  }
}
