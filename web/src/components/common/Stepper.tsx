import React from 'react';

interface StepperProps {
  activeStep: number;
  completedSteps?: number;
}

const STEPS = [
  'Submission',
  'Verification',
  'Proposal',
  'Payment',
  'Activation',
];

export const Stepper: React.FC<StepperProps> = ({
  activeStep,
  completedSteps = 0,
}) => {
  return (
    <div className="stepper">
      {STEPS.map((stepName, idx) => {
        const stepNum = idx + 1;
        const isDone = stepNum <= completedSteps;
        const isActive = stepNum === activeStep;

        return (
          <div
            key={stepName}
            className={`step-item ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}
          >
            <div className="step-circle">{isDone ? '✓' : stepNum}</div>
            <span className="step-label">{stepName}</span>
          </div>
        );
      })}
    </div>
  );
};
