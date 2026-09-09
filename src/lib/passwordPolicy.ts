import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .regex(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula.")
  .regex(/[0-9]/, "A senha deve conter ao menos um número.")
  .regex(/[^A-Za-z0-9]/, "A senha deve conter ao menos um caractere especial.");

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Muito fraca" | "Fraca" | "Média" | "Forte" | "Muito forte";
  color: string;
}

export function evaluatePasswordStrength(senha: string): PasswordStrength {
  let score = 0;
  if (senha.length >= PASSWORD_MIN_LENGTH) score++;
  if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) score++;
  if (/[0-9]/.test(senha)) score++;
  if (/[^A-Za-z0-9]/.test(senha)) score++;
  if (senha.length >= 12) score = Math.min(4, score + 1);

  const map: Record<number, PasswordStrength> = {
    0: { score: 0, label: "Muito fraca", color: "bg-destructive" },
    1: { score: 1, label: "Fraca", color: "bg-destructive" },
    2: { score: 2, label: "Média", color: "bg-yellow-500" },
    3: { score: 3, label: "Forte", color: "bg-emerald-500" },
    4: { score: 4, label: "Muito forte", color: "bg-emerald-600" },
  };
  return map[score as 0 | 1 | 2 | 3 | 4];
}

/** True quando a senha está armazenada como hash bcrypt. */
export function isBcryptHash(s?: string | null): boolean {
  if (!s) return false;
  return /^\$2[aby]\$\d{2}\$/.test(s);
}
