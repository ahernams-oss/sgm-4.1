import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import type { Cliente } from "@/contexts/ClientesContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const normalizeSearch = (value: string) =>
  value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

interface FornecedorComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: Cliente[];
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}

export default function FornecedorCombobox({
  value,
  onChange,
  options,
  placeholder = "Selecione um fornecedor...",
  emptyMessage,
  disabled,
}: FornecedorComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((fornecedor) => fornecedor.id === value);
  const noOptionsMessage = emptyMessage || "Nenhum fornecedor disponível.";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Selecionar fornecedor"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
            {selected?.nome || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[18rem] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const terms = normalizeSearch(search).split(/\s+/).filter(Boolean);
            const searchable = normalizeSearch(itemValue);
            return terms.every((term) => searchable.includes(term)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar por nome, fantasia, CNPJ ou código..." />
          <CommandList className="max-h-72">
            <CommandEmpty>{options.length === 0 ? noOptionsMessage : "Nenhum fornecedor encontrado."}</CommandEmpty>
            {value && (
              <CommandGroup>
                <CommandItem
                  value="limpar selecao"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Limpar seleção
                </CommandItem>
              </CommandGroup>
            )}
            {options.length > 0 && (
              <CommandGroup heading={`${options.length} fornecedor(es) disponível(is)`}>
                {options.map((fornecedor) => {
                  const secondary = [
                    fornecedor.nomeFantasia && fornecedor.nomeFantasia !== fornecedor.nome ? fornecedor.nomeFantasia : "",
                    fornecedor.cnpj,
                    fornecedor.codigo ? `Cód. ${fornecedor.codigo}` : "",
                  ].filter(Boolean).join(" · ");

                  return (
                    <CommandItem
                      key={fornecedor.id}
                      value={`${fornecedor.id} ${fornecedor.nome} ${fornecedor.nomeFantasia} ${fornecedor.cnpj} ${fornecedor.codigo || ""}`}
                      onSelect={() => {
                        onChange(fornecedor.id);
                        setOpen(false);
                      }}
                      className="items-start py-2.5"
                    >
                      <Check className={cn("mr-2 mt-0.5 h-4 w-4 shrink-0", value === fornecedor.id ? "opacity-100" : "opacity-0")} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{fornecedor.nome}</span>
                        {secondary && <span className="block truncate text-xs text-muted-foreground">{secondary}</span>}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}