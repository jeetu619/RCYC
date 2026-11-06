interface ProgressBarProps {
  currentStep: number;
  steps: string[];
}

export default function ProgressBar({ currentStep, steps }: ProgressBarProps) {
  const percentage = (currentStep / steps.length) * 100;

  return (
    <nav className="progress-container" aria-label="Enquiry progress">
      <div
        className="progress-bar"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={currentStep}
        aria-valuetext={`Step ${currentStep} of ${steps.length}: ${steps[currentStep - 1]}`}
      >
        <div className="progress-fill" style={{ width: `${percentage}%` }} />
      </div>
      <ol className="progress-steps">
        {steps.map((label, index) => {
          const n = index + 1;
          return (
            <li
              key={label}
              className={`progress-step ${n <= currentStep ? 'active' : ''} ${n === currentStep ? 'current' : ''}`}
              aria-current={n === currentStep ? 'step' : undefined}
            >
              <span className="step-number">{n}</span>
              <span className="step-label">{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
