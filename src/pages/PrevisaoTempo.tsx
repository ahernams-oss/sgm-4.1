import { ClimaInicial } from "@/components/ClimaInicial";

export default function PrevisaoTempo() {
  return (
    <div className="w-full space-y-6 py-6">
      <h1 className="px-4 text-2xl font-semibold sm:px-6">Previsão do tempo</h1>
      <ClimaInicial />
    </div>
  );
}