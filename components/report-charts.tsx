"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  BarXAxis,
  ChartTooltip,
  Grid,
  Legend,
  type LegendItemData,
  LegendItemComponent,
  LegendLabel,
  LegendMarker,
  LegendProgress,
  LegendValue,
  RadarArea,
  RadarAxis,
  RadarChart,
  type RadarData,
  RadarGrid,
  RadarLabels,
  type RadarMetric,
  Ring,
  RingCenter,
  RingChart,
  type RingData,
} from "@/components/bklit";
import { GRADES } from "@/lib/config";
import type { House } from "@/lib/types";

/**
 * House display order for charts: keeps Loyola and Xavier non-adjacent so
 * every neighboring pair clears CVD separation (validated); each house
 * always keeps its own color, and text labels back the colors everywhere.
 */
export function chartHouseOrder(houses: House[]): House[] {
  const order = ["aquinas", "loyola", "brebeuf", "xavier"];
  return [...houses].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

/** Check-ins per event, chronological. Single series → neutral ink fill. */
export function EventAttendanceChart({
  events,
}: {
  events: { label: string; checkins: number }[];
}) {
  const data = useMemo(
    () => events.map((e) => ({ label: e.label, checkins: e.checkins })),
    [events]
  );
  if (data.length === 0) return null;
  return (
    <BarChart aspectRatio="2 / 1" barGap={0.35} data={data} xDataKey="label">
      <Grid horizontal />
      <Bar dataKey="checkins" fill="#44403c" lineCap={4} />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}

/** Share of all check-ins by house — activity rings + labeled legend. */
export function HouseShareRings({
  rows,
  total,
}: {
  rows: { house: House; count: number }[];
  total: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const data: RingData[] = rows.map((r) => ({
    label: r.house.name,
    value: r.count,
    maxValue: Math.max(total, 1),
    color: r.house.color,
  }));
  const legendItems: LegendItemData[] = data.map((d) => ({
    label: d.label,
    value: d.value,
    maxValue: d.maxValue,
    color: d.color ?? "",
  }));
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
      <RingChart
        data={data}
        hoveredIndex={hovered}
        onHoverChange={setHovered}
        size={210}
      >
        {data.map((item, index) => (
          <Ring index={index} key={item.label} />
        ))}
        <RingCenter defaultLabel="Check-ins" />
      </RingChart>
      <Legend
        className="w-full flex-1"
        hoveredIndex={hovered}
        items={legendItems}
        onHoverChange={setHovered}
      >
        <LegendItemComponent className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2.5 gap-y-1">
          <LegendMarker />
          <LegendLabel />
          <LegendValue showPercentage />
          <div className="col-span-full">
            <LegendProgress />
          </div>
        </LegendItemComponent>
      </Legend>
    </div>
  );
}

/** Participation rate per grade, one polygon per house. */
export function GradeRadar({
  houses,
  /** houseId -> grade -> participation percent 0-100 */
  rates,
}: {
  houses: House[];
  rates: Record<string, Record<number, number>>;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const metrics: RadarMetric[] = GRADES.map((g) => ({
    key: `g${g}`,
    label: `Gr ${g}`,
  }));
  const data: RadarData[] = houses.map((h) => ({
    label: h.name,
    color: h.color,
    values: Object.fromEntries(
      GRADES.map((g) => [`g${g}`, rates[h.id]?.[g] ?? 0])
    ),
  }));
  const legendItems: LegendItemData[] = data.map((d) => ({
    label: d.label,
    value:
      Object.values(d.values).reduce((a, b) => a + b, 0) / metrics.length,
    maxValue: 100,
    color: d.color ?? "",
  }));
  return (
    <div className="flex flex-col items-center gap-4">
      <RadarChart
        data={data}
        hoveredIndex={hovered}
        metrics={metrics}
        onHoverChange={setHovered}
        size={300}
      >
        <RadarGrid />
        <RadarAxis />
        <RadarLabels />
        {data.map((item, index) => (
          <RadarArea index={index} key={item.label} />
        ))}
      </RadarChart>
      <Legend
        className="w-full"
        hoveredIndex={hovered}
        items={legendItems}
        onHoverChange={setHovered}
      >
        <LegendItemComponent className="flex items-center gap-2.5">
          <LegendMarker />
          <LegendLabel className="flex-1" />
          <LegendValue formatValue={(v) => `${v.toFixed(0)}% avg`} />
        </LegendItemComponent>
      </Legend>
    </div>
  );
}
