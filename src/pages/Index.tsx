import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import RequisicaoForm from "@/components/RequisicaoForm";
import RequisicaoGrid from "@/components/RequisicaoGrid";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="bg-background">
      <div className="container max-w-full mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-up flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Requisições</span>
            </div>
            <h1 className="text-xl font-bold text-foreground mb-1">RP — Requisição de Pessoal</h1>
            <p className="text-sm text-muted-foreground max-w-lg">
              Gerencie as solicitações de contratação de novos colaboradores.
            </p>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova RC
            </Button>
          )}
        </div>

        {showForm && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Nova Requisição</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
            <RequisicaoForm onSuccess={() => setShowForm(false)} />
          </div>
        )}

        <RequisicaoGrid />
      </div>
    </div>
  );
};

export default Index;