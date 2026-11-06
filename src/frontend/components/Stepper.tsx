interface StepperProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  error?: string;
  hint?: string;
}

/** Accessible +/- number control. The buttons disable at the limits so the range can't be exceeded. */
export default function Stepper({ id, label, value, min, max, onChange, error, hint }: StepperProps) {
  const describedBy = [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="form-group">
      <span id={`${id}-label`} className="label">
        {label}
      </span>
      <div className="stepper" role="group" aria-labelledby={`${id}-label`}>
        <button
          type="button"
          className="stepper-button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
        >
          −
        </button>
        <output id={id} className="stepper-value" aria-live="polite" aria-describedby={describedBy}>
          {value}
        </output>
        <button
          type="button"
          className="stepper-button"
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
        >
          +
        </button>
      </div>
      {hint && (
        <div id={`${id}-hint`} className="hint">
          {hint}
        </div>
      )}
      {error && (
        <div id={`${id}-error`} className="error-message" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
