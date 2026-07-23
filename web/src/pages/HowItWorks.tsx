import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { SectionHeader } from "../components/SectionHeader";
import { StepCard } from "../components/StepCard";
import { useScrollReveal } from "../lib/useScrollReveal";

const STEPS = [
  {
    number: "01",
    title: "SMS Interception",
    description:
      "BantAI registers as the device's default SMS handler, so every inbound message is intercepted at the point of arrival before it ever reaches the user's inbox unscreened.",
    icon: <InboxIcon />,
  },
  {
    number: "02",
    title: "Privacy Masking",
    description:
      "Sender numbers are irreversibly hashed and the raw message body is never persisted to disk. Only the classification result and masked metadata are retained.",
    icon: <LockIcon />,
  },
  {
    number: "03",
    title: "XLM-RoBERTa Classification",
    description:
      "A fine-tuned multilingual transformer scores the (in-memory) message text across Tagalog, English, and Taglish, producing a smishing-probability score.",
    icon: <BrainIcon />,
  },
  {
    number: "04",
    title: "SHAP Explainability",
    description:
      "SHAP value attribution highlights exactly which words and phrases pushed the score toward \"smishing\" — analysts see the reasoning, not just a verdict.",
    icon: <SparkIcon />,
  },
  {
    number: "05",
    title: "HDBSCAN Clustering",
    description:
      "Flagged messages are embedded and clustered with HDBSCAN, grouping structurally similar reports across senders and users into a single tracked campaign.",
    icon: <ClusterDotsIcon />,
  },
  {
    number: "06",
    title: "Alert + Auto-block",
    description:
      "The user receives an immediate on-device alert with the confidence score and triggered indicators, with an option to auto-block the sending number.",
    icon: <ShieldAlertIcon />,
  },
];

export function HowItWorksPage() {
  useScrollReveal();

  return (
    <div className="site-shell">
      <Navbar />

      <header className="page-hero">
        <div className="page-hero-inner reveal reveal-up" data-reveal>
          <span className="section-eyebrow">Technical Pipeline</span>
          <h1>How BantAI Detects Threats</h1>
          <p>
            From the moment an SMS lands on a Filipino subscriber's phone to the moment it is
            surfaced as part of a tracked campaign, six stages run entirely on-device and in the
            BantAI intelligence backend — combining multilingual NLP, explainable AI, and
            unsupervised clustering.
          </p>
        </div>
      </header>

      <section className="section timeline-section">
        <div className="timeline-rail" aria-hidden="true" />
        <div className="timeline-steps">
          {STEPS.map((step, index) => (
            <StepCard
              key={step.number}
              number={step.number}
              title={step.title}
              description={step.description}
              icon={step.icon}
              timeline
              reveal={index % 2 === 0 ? "reveal-left" : "reveal-right"}
            />
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}

function InboxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16v12H4z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 6l8 7 8-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 10V7a4 4 0 118 0v3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 6v12M8 9.5h8M8 14.5h8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function ClusterDotsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8.5L11 16M16 8.5L13 16M8.5 7H15.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function ShieldAlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 9v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="16" r="0.6" fill="currentColor" />
    </svg>
  );
}
