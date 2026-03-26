import { createServerClient, type CampaignRow } from "./lib/supabase";
import CampaignCard from "./components/CampaignCard";

export const dynamic = "force-dynamic";

export default async function Home() {
  let campaigns: CampaignRow[] = [];
  let error: string | null = null;

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    error = "SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY tanımlı değil. Lütfen .env.local dosyasını oluşturun.";
  } else {
    try {
      const supabase = createServerClient();
      const { data, error: dbError } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (dbError) {
        error = dbError.message;
      } else {
        campaigns = data ?? [];
      }
    } catch {
      error = "Veritabanına bağlanılamadı. Lütfen .env dosyasını kontrol edin.";
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Güncel Kampanyalar
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Forum sitelerinden toplanan en son indirim ve fırsatlar
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      {campaigns.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 py-16 dark:border-slate-700">
          <svg
            className="mb-4 h-12 w-12 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
            Henüz kampanya bulunamadı
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">
            Kampanyaları çekmek için{" "}
            <a
              href="/api"
              className="font-medium text-primary underline hover:text-primary-dark"
            >
              Kampanyaları Güncelle
            </a>
            {" "}butonuna tıklayın.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </main>
  );
}
