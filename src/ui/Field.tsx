import type { ReactNode } from "react";

interface Props {
  id: string;
  label: string;
  value: number;
  limits: { min: number; max: number; step: number };
  output: string;
  hint?: ReactNode;
  onChange: (v: number) => void;
}

export function Field({ id, label, value, limits, output, hint, onChange }: Props) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id}>{output}</output>
      <input type="range" id={id} {...limits} value={value} onChange={e => onChange(parseFloat(e.target.value))} />
      {hint && <small>{hint}</small>}
    </div>
  );
}
