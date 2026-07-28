import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { SectionHeader } from "../components/SectionHeader";
import { useScrollReveal } from "../lib/useScrollReveal";

const TEAM = [
  { initials: "AC", name: "Arias C. Castro", role: "Machine Learning & NLP Pipeline" },
  { initials: "DR", name: "D. De Castro", role: "Mobile Application & Systems Integration" },
  { initials: "RM", name: "R. Mendoza", role: "Backend, Data, & Threat Clustering" },
];

const TECH_STACK = [
  { label: "Kotlin", detail: "Android mobile app" },
  { label: "XLM-RoBERTa", detail: "Multilingual classification" },
  { label: "HDBSCAN", detail: "Campaign clustering" },
  { label: "SHAP", detail: "Explainability" },
  { label: "React + Vite", detail: "Intelligence dashboard" },
  { label: "NestJS", detail: "Backend API" },
];

export function AboutPage() {
  useScrollReveal();

  return (
    <div className="site-shell">
      <Navbar />

      <header className="page-hero">
        <div className="page-hero-inner reveal reveal-up" data-reveal>
          <span className="section-eyebrow">Group 7 &mdash; DLSL CITE</span>
          <h1>About BantAI</h1>
          <p>
            BantAI is an undergraduate thesis project from the College of Information Technology
            and Engineering at De La Salle Lipa, built to give Filipino mobile users and the
            organizations that protect them a real-time, explainable defense against SMS-based fraud.
          </p>
        </div>
      </header>

      <section className="section">
        <SectionHeader
          eyebrow="The Problem"
          title="Smishing in the Philippines"
          subtitle="SMS-based phishing — smishing — remains one of the most reported forms of fraud against Filipino mobile users, exploiting trust in banks, e-wallets, and telecom providers."
          align="left"
        />
        <div className="mission-copy reveal reveal-up" data-reveal>
          <p>
            Existing spam filters are largely English-only and rule-based, missing the Tagalog and
            Taglish phrasing that most Philippine smishing campaigns actually use. Reports also
            arrive as isolated incidents, with no way for a telecom or CERT team to see that fifty
            different subscribers just received the same coordinated attack under fifty different
            phone numbers.
          </p>
          <p>
            BantAI was built to close both gaps: a multilingual classifier trained specifically on
            Philippine smishing patterns, and an unsupervised clustering layer that surfaces
            coordinated campaigns as they spread — with every decision made explainable via SHAP,
            not left as a black box.
          </p>
        </div>
      </section>

      <section className="section">
        <SectionHeader eyebrow="The Team" title="Group 7" subtitle="Thesis research team, College of Information Technology and Engineering." />
        <div className="team-grid reveal-stagger" data-reveal>
          {TEAM.map((member) => (
            <article key={member.name} className="team-card">
              <span className="team-avatar">{member.initials}</span>
              <strong>{member.name}</strong>
              <p>{member.role}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="adviser-card reveal reveal-up" data-reveal>
          <span className="section-label">Adviser Acknowledgement</span>
          <p>
            This research was conducted under the guidance and supervision of the thesis adviser
            and panel at the College of Information Technology and Engineering, De La Salle Lipa,
            whose feedback shaped the platform's technical direction and evaluation methodology.
          </p>
        </div>
      </section>

      <section className="section">
        <SectionHeader eyebrow="Technology" title="Built With" />
        <div className="tech-stack-grid reveal-stagger" data-reveal>
          {TECH_STACK.map((tech) => (
            <div key={tech.label} className="tech-badge">
              <strong>{tech.label}</strong>
              <small>{tech.detail}</small>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
