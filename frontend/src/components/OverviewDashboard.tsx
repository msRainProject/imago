import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts';
import { FileImage, HardDrive, TrendingUp, Users } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchStats } from '@/api/public';
import { listFiles } from '@/api/fileManager';
import type { ImageItem, StatsResponse } from '@/api/types';
import { formatBytes } from '@/utils/format';

/* ------------------------------ Data hooks ------------------------------ */

function useDashboardData() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [recentFiles, setRecentFiles] = useState<ImageItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statsRes, filesRes] = await Promise.allSettled([
          fetchStats(),
          listFiles({ page: 1, pageSize: 200, sort: 'date' }),
        ]);
        if (cancelled) return;
        if (statsRes.status === 'fulfilled') setStats(statsRes.value);
        if (filesRes.status === 'fulfilled') setRecentFiles(filesRes.value.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, recentFiles, loading };
}

/* --------------------------- Aggregation utils -------------------------- */

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 14;

function buildTrend(files: ImageItem[]): { date: string; label: string; uploads: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = new Map<string, number>();
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const f of files) {
    const key = new Date(f.uploaded_at).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([date, uploads]) => {
    const d = new Date(date);
    return { date, label: `${d.getMonth() + 1}/${d.getDate()}`, uploads };
  });
}

function buildTypeDistribution(files: ImageItem[]): { type: string; count: number }[] {
  const map = new Map<string, number>();
  for (const f of files) {
    const ext = (f.mime_type?.split('/')[1] ?? f.name.split('.').pop() ?? 'other').toLowerCase();
    map.set(ext, (map.get(ext) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));
}

/* ------------------------------ Chart config ---------------------------- */

const trendConfig = {
  uploads: { label: '上传数', color: 'hsl(var(--primary))' },
} satisfies ChartConfig;

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

/* -------------------------------- Component ----------------------------- */

export default function OverviewDashboard() {
  const { stats, recentFiles, loading } = useDashboardData();

  const trend = useMemo(() => (recentFiles ? buildTrend(recentFiles) : []), [recentFiles]);
  const typeDist = useMemo(
    () => (recentFiles ? buildTypeDistribution(recentFiles) : []),
    [recentFiles],
  );
  const recentTotal = trend.reduce((sum, d) => sum + d.uploads, 0);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
        <StatCard
          icon={<FileImage className="h-4 w-4" />}
          label="文件总数"
          value={stats ? String(stats.total_images) : null}
          loading={loading}
        />
        <StatCard
          icon={<HardDrive className="h-4 w-4" />}
          label="存储用量"
          value={stats ? formatBytes(stats.total_size) : null}
          loading={loading}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label={`近 ${TREND_DAYS} 天上传`}
          value={recentFiles ? String(recentTotal) : null}
          loading={loading}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="用户数"
          value={stats ? String(stats.total_users) : null}
          loading={loading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 sm:gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>上传趋势</CardTitle>
            <CardDescription>近 {TREND_DAYS} 天的每日上传数量</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <ChartContainer config={trendConfig} className="h-[220px] w-full">
                <AreaChart data={trend} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="fillUploads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval="preserveStartEnd"
                  />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    dataKey="uploads"
                    type="monotone"
                    fill="url(#fillUploads)"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>文件类型分布</CardTitle>
            <CardDescription>最近 {recentFiles?.length ?? 0} 个文件</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            {loading ? (
              <Skeleton className="h-[180px] w-[180px] rounded-full" />
            ) : typeDist.length > 0 ? (
              <>
                <ChartContainer config={{}} className="h-[180px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="type" />} />
                    <Pie
                      data={typeDist}
                      dataKey="count"
                      nameKey="type"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {typeDist.map((entry, i) => (
                        <Cell key={entry.type} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                  {typeDist.map((entry, i) => (
                    <li key={entry.type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        aria-hidden
                      />
                      {entry.type}
                      <span className="tabular-nums">{entry.count}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="py-16 text-sm text-muted-foreground">暂无数据</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------- Stat card ----------------------------- */

function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </span>
        </div>
        {loading || value === null ? (
          <Skeleton className="mt-2 h-7 w-20" />
        ) : (
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
