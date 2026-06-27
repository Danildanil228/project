type RangeControlProps = {
    label: string;
    value: number;
    valueLabel: string;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    scaleLabels?: [string, string, string];
    onChange: (value: number) => void;
};

export function RangeControl({
    label,
    value,
    valueLabel,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    scaleLabels = ["0%", "50%", "100%"],
    onChange,
}: RangeControlProps) {
    return (
        <div className="grid gap-2">
            <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono font-bold">{valueLabel}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(Number(event.target.value))}
                className="w-full accent-primary disabled:opacity-40 focus:outline-none! focus-visible:outline-none!"
                aria-label={label}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground" aria-hidden="true">
                {scaleLabels.map((item) => <span key={item}>{item}</span>)}
            </div>
        </div>
    );
}
