import DashboardKpiCard from "@/components/dashboard/DashboardKpiCard";
import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  trend?: number | null;
  onClick?: () => void;
}

const toneIdx: Record<NonNullable<Props["tone"]>, number> = {
  default: 0,
  success: 1,
  warning: 2,
  danger: 3,
  info: 5,
};

export default function KpiCardFinanceiro({ title, value, subtitle, icon, tone = "default", trend, onClick }: Props) {
  return (
    <DashboardKpiCard
      icon={icon}
      label={title}
      value={value}
      subtitle={subtitle}
      trend={trend}
      onClick={onClick}
      gradientIdx={toneIdx[tone]}
    />
  );
}
