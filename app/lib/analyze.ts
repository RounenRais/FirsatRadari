import Anthropic from "@anthropic-ai/sdk";
import type { Campaign } from "./scraper";

type AnalysisResult = {
  index: number;
  isValid: boolean;
  category: string;
};

export type ValidCampaign = Campaign & { category: string };

const SYSTEM_PROMPT = `Sen bir kampanya analiz asistanısın.

Geçerli kampanya kriterleri — bunlardan en az biri olmalı:
- Belirli bir ürünün fiyatını içeriyor ("X ürün 200TL")
- İndirim oranı belirtiliyor ("%30 indirim")
- Hediye/kupon/indirim kodu var ("200TL hediye kodu")
- Sınırlı süreli teklif ("bugün son gün", "stok tükeniyor")
- Belirli bir kampanya linki paylaşılıyor

Geçersiz say — bunlardan biri varsa reddet:
- Genel sohbet ve tartışma konuları
- Sadece marka veya ürün kategorisi hakkında genel konu
- Soru-cevap konuları
- "ANA KONU", "Sabit Konu", "Sponsorlu İçerik" içerenler
- Belirli bir fiyat veya indirim belirtmeyen konular

Sadece JSON döndür, başka hiçbir şey yazma:
[{"index": 0, "isValid": true, "category": "elektronik"}, ...]`;

export async function analyzeCampaigns(
  campaigns: Campaign[]
): Promise<ValidCampaign[]> {
  if (campaigns.length === 0) return [];

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  const validCampaigns: ValidCampaign[] = [];
  const BATCH_SIZE = 50;

  for (let i = 0; i < campaigns.length; i += BATCH_SIZE) {
    const batch = campaigns.slice(i, i + BATCH_SIZE);

    const campaignList = batch
      .map((c, idx) => `${idx}. [${c.source}] ${c.title}`)
      .join("\n");

    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `Aşağıdaki kampanya başlıklarını analiz et:\n\n${campaignList}`,
          },
        ],
        system: SYSTEM_PROMPT,
      });

      let text =
        response.content[0].type === "text" ? response.content[0].text : "";

      // Claude bazen ```json ... ``` ile sarıyor, temizle
      text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

      const results: AnalysisResult[] = JSON.parse(text);

      for (const result of results) {
        if (result.isValid && batch[result.index]) {
          const campaign = batch[result.index];
          validCampaigns.push({
            ...campaign,
            category: campaign.category || result.category || "diger",
          });
        }
      }
    } catch (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} analiz hatası:`, error);
    }
  }

  return validCampaigns;
}
