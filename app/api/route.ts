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

export async function GET() {
  try {
    console.log("Scraping başlıyor...");

    const results = await Promise.allSettled([
      scrapeDonanimArsivi(),
      scrapeDonanimhaber(),
      scrapeTechnopat(),
      scrapeR10(),
    ]);

    const allCampaigns = results.flatMap((result, index) => {
      const sources = ["donanimarsivi", "donanimhaber", "technopat", "r10"];
      if (result.status === "fulfilled") {
        console.log(`${sources[index]}: ${result.value.length} kampanya bulundu`);
        return result.value;
      } else {
        console.error(`${sources[index]} hatası:`, result.reason);
        return [];
      }
    });

    console.log(`Toplam ${allCampaigns.length} kampanya bulundu, analiz ediliyor...`);

    const validCampaigns = await analyzeCampaigns(allCampaigns);
    console.log(`${validCampaigns.length} geçerli kampanya bulundu`);

    let savedCount = 0;

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        success: true,
        scraped: allCampaigns.length,
        valid: validCampaigns.length,
        saved: 0,
        warning: "SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY tanımlı değil, veritabanına kaydedilmedi.",
        campaigns: validCampaigns,
      });
    }

    const supabase = createServerClient();

    if (validCampaigns.length > 0) {
      const rows = validCampaigns.map((c) => ({
        title: c.title,
        link: c.link,
        source: c.source,
        category: c.category,
      }));

      const { data, error } = await supabase
        .from("campaigns")
        .upsert(rows, { onConflict: "link", ignoreDuplicates: true })
        .select();

      if (error) {
        console.error("Supabase kayıt hatası:", error);
      } else {
        savedCount = data?.length ?? 0;
      }
    }

    return NextResponse.json({
      success: true,
      scraped: allCampaigns.length,
      valid: validCampaigns.length,
      saved: savedCount,
      sources: {
        donanimarsivi: results[0].status === "fulfilled" ? results[0].value.length : 0,
        donanimhaber: results[1].status === "fulfilled" ? results[1].value.length : 0,
        technopat: results[2].status === "fulfilled" ? results[2].value.length : 0,
        r10: results[3].status === "fulfilled" ? results[3].value.length : 0,
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
