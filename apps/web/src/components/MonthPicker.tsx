import { inputClass } from './fields';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

interface MonthPickerProps {
  id: string;
  value: string;
  onChange: (month: string) => void;
  label?: string;
}

/** A native month input (YYYY-MM). Incomplete values are ignored until they are valid. */
export function MonthPicker({ id, value, onChange, label = 'Month' }: MonthPickerProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type="month"
        value={value}
        onChange={(event) => {
          if (MONTH.test(event.target.value)) onChange(event.target.value);
        }}
        className={inputClass}
      />
    </div>
  );
}
