interface RadioGroupCustomProps {
  options: string[];
  selected: string;
  onChange: (value: string) => void;
  columns?: number;
}

const RadioGroupCustom = ({ options, selected, onChange, columns = 3 }: RadioGroupCustomProps) => (
  <div
    className="grid gap-2"
    style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
  >
    {options.map((option) => (
      <label
        key={option}
        className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm cursor-pointer transition-all duration-200
          ${
            selected === option
              ? "border-primary bg-primary/5 text-foreground shadow-sm"
              : "border-border bg-card text-muted-foreground hover:border-primary/40"
          }`}
        onClick={() => onChange(option)}
      >
        <div
          className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-150
            ${selected === option ? "border-primary" : "border-muted-foreground/40"}`}
        >
          {selected === option && <div className="h-2 w-2 rounded-full bg-primary" />}
        </div>
        {option}
      </label>
    ))}
  </div>
);

export default RadioGroupCustom;