import type { Yacht } from '../../shared/types';
import DatePicker from './DatePicker';
import FieldError from './FieldError';
import YachtSelector from './YachtSelector';

interface StepYachtDatesProps {
  yachts: Yacht[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  yachtId?: string;
  startDate?: string;
  errors: Record<string, string>;
  onSelectYacht: (yachtId: string) => void;
  onSelectDate: (startDate: string) => void;
}

export default function StepYachtDates(props: StepYachtDatesProps) {
  return (
    <div className="form-step">
      <h2 id="step-1-title" className="visually-hidden">
        Yacht and dates
      </h2>
      <YachtSelector
        yachts={props.yachts}
        loading={props.loading}
        error={props.error}
        onRetry={props.onRetry}
        selectedYachtId={props.yachtId}
        onSelect={props.onSelectYacht}
      />
      <FieldError field="yachtId" message={props.errors.yachtId} />
      {/* If the yacht list could not load, dependent fields are disabled (spec §12). */}
      <DatePicker
        yachtId={props.error ? undefined : props.yachtId}
        selectedDate={props.startDate}
        onSelect={props.onSelectDate}
      />
      <FieldError field="startDate" message={props.errors.startDate} />
    </div>
  );
}
