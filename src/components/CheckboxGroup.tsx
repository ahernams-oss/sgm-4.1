interface CheckboxGroupProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  columns?: number;
}

const CheckboxGroup = ({ options, selected, onChange, columns = 3 }: CheckboxGroupProps) => {
  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <label
          key={option}
          className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm cursor-pointer transition-all duration-200
            ${
              selected.includes(option)
                ? "border-primary bg-primary/5 text-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/40"
            }`}
        >
          <div
            className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors duration-150
              ${selected.includes(option) ? "border-primary bg-primary" : "border-muted-foreground/40"}`}
          >
            {selected.includes(option) && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          {option}
        </label>
      ))}
    </div>
  );
};

export default CheckboxGroup;