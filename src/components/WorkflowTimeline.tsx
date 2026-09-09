import { CheckCircle2, Circle, Clock } from "lucide-react";

export interface WorkflowStep {
  label: string;
  color?: string;
}

interface WorkflowTimelineProps {
  steps: WorkflowStep[];
  currentStep: string;
  historico?: { situacao: string; data: string; usuario: string }[];
}

export default function WorkflowTimeline({ steps, currentStep, historico = [] }: WorkflowTimelineProps) {
  const currentIndex = steps.findIndex(s => s.label === currentStep);

  const getStepDate = (label: string) => {
    const entry = [...historico].reverse().find(h => h.situacao === label);
    if (!entry) return null;
    return new Date(entry.data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-2">
      {steps.map((step, i) => {
        const isPast = i < currentIndex;
        const isCurrent = step.label === currentStep;
        const stepDate = getStepDate(step.label);

        return (
          <div key={step.label} className="flex items-start flex-shrink-0">
            <div className="flex flex-col items-center min-w-[90px]">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                isCurrent
                  ? "border-primary bg-primary text-primary-foreground"
                  : isPast
                    ? "border-green-500 bg-green-500 text-white"
                    : "border-muted-foreground/30 bg-background text-muted-foreground/40"
              }`}>
                {isPast ? <CheckCircle2 className="h-4 w-4" /> : isCurrent ? <Clock className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              </div>
              <span className={`text-[10px] mt-1 text-center leading-tight max-w-[80px] ${
                isCurrent ? "font-bold text-foreground" : isPast ? "text-green-600 font-medium" : "text-muted-foreground/50"
              }`}>
                {step.label}
              </span>
              {stepDate && (
                <span className="text-[9px] text-muted-foreground mt-0.5">{stepDate}</span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-[2px] w-8 mt-4 ${
                i < currentIndex ? "bg-green-500" : "bg-muted-foreground/20"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
