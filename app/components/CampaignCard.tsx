import type { CampaignRow } from "../lib/supabase";

const sourceColors: Record<string, string> = {
  donanimhaber: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  donanimarsivi: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  technopat: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  r10: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const sourceLabels: Record<string, string> = {
  donanimhaber: "DonanımHaber",
  donanimarsivi: "DonanımArşivi",
  technopat: "Technopat",
  r10: "R10",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  if (diffHour < 24) return `${diffHour} saat önce`;
  return `${diffDay} gün önce`;
}

export default function CampaignCard({ campaign }: { campaign: CampaignRow }) {
  const sourceColor = sourceColors[campaign.source] || "bg-slate-100 text-slate-800";
  const sourceLabel = sourceLabels[campaign.source] || campaign.source;

  return (
    <a
      href={campaign.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-primary/40"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${sourceColor}`}>
          {sourceLabel}
        </span>
        {campaign.category && campaign.category !== "diger" && (
          <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            {campaign.category}
          </span>
        )}
      </div>

      <h3 className="mb-3 text-base font-semibold leading-snug text-slate-900 group-hover:text-primary dark:text-slate-100 dark:group-hover:text-primary">
        {campaign.title}
      </h3>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {timeAgo(campaign.created_at)}
      </p>
    </a>
  );
}
