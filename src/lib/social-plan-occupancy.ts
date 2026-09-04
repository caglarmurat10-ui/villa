export interface RollingPlanOccupancyRow {
  status: string;
  approvalStatus: string | null;
}

export function occupiesRollingFutureSlot(row: RollingPlanOccupancyRow): boolean {
  return row.status === "Yayınlandı" || (row.status === "Planlandı" && row.approvalStatus === "Onaylandı");
}
