// Detecta se o SGM está aberto como app instalado na tela inicial (PWA).
//
// A digital só faz sentido nesse modo: é ele que representa o app no celular.
// Em aba comum de navegador a leitura fica desligada.

export type SinaisApp = {
  /** display-mode: standalone ou minimal-ui (Android/Chrome e outros). */
  displayModeStandalone?: boolean;
  /** navigator.standalone (iPhone/iPad). */
  iosStandalone?: boolean;
};

/** Regra pura, sem depender do navegador, para poder ser testada. */
export function estaEmAppInstaladaSinais(sinais: SinaisApp): boolean {
  return sinais.displayModeStandalone === true || sinais.iosStandalone === true;
}

/** O SGM está aberto como app instalado? */
export function estaEmAppInstalada(): boolean {
  if (typeof window === "undefined") return false;

  let displayModeStandalone = false;
  try {
    displayModeStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches;
  } catch {
    displayModeStandalone = false;
  }

  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;

  return estaEmAppInstaladaSinais({ displayModeStandalone, iosStandalone });
}
