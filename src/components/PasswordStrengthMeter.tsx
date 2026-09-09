import { evaluatePasswordStrength } from "@/lib/passwordPolicy";

interface Props {
  senha: string;
}

export function PasswordStrengthMeter({ senha }: Props) {
  if (!senha) return null;
  const { score, label, color } = evaluatePasswordStrength(senha);
  const segments = 4;
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < score ? color : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Força da senha: <span className="font-medium text-foreground">{label}</span>
      </p>
    </div>
  );
}
