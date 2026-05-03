import { api } from "@/lib/api/client";
import type { ReportSummary } from "@/lib/types";

export async function fetchReportSummary(query: {
  from: string;
  to: string;
}): Promise<{ data: ReportSummary }> {
  return api.get<{ data: ReportSummary }>("reports/summary", { query });
}
