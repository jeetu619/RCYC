interface FieldErrorProps {
  field: string;
  message?: string;
}

/** Inline error text; the id matches the `aria-describedby` on the input (see `describedBy`). */
export default function FieldError({ field, message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <div id={`${field}-error`} className="error-message" role="alert">
      {message}
    </div>
  );
}

export const describedBy = (field: string, message?: string) => (message ? `${field}-error` : undefined);
