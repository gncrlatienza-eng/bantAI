import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { SectionHeader } from "../components/SectionHeader";
import { useScrollReveal } from "../lib/useScrollReveal";

const HIGHLIGHTS = [
  {
    tag: "Threat Landscape",
    title: "The Smishing Landscape in the Philippines",
    abstract:
      "A survey of reported SMS fraud patterns across Philippine telecom subscribers, examining how attackers impersonate banks, e-wallets, and government agencies, and how tactics have shifted over time.",
  },
  {
    tag: "NLP Research",
    title: "Multilingual NLP Challenges in Tagalog-English Text",
    abstract:
      "An evaluation of transformer-based classifiers on code-switched Tagalog-English (Taglish) SMS text, and the adaptations required to reach reliable smishing detection accuracy in a low-resource multilingual setting.",
  },
  {
    tag: "Methodology",
    title: "Campaign Detection via Density-Based Clustering",
    abstract:
      "A methodology for grouping independently reported smishing messages into coordinated campaigns using HDBSCAN over semantic embeddings, evaluated against manually labeled campaign ground truth.",
  },
];

const LANGUAGE_DISTRIBUTION = [
  { label: "Taglish", value: 46, tone: "" },
  { label: "Tagalog", value: 33, tone: "amber" },
  { label: "English", value: 21, tone: "gray" },
];

const THREAT_DISTRIBUTION = [
  { label: "Smishing (Financial)", value: 58, tone: "" },
  { label: "Credential Phishing", value: 27, tone: "amber" },
  { label: "Other / Legitimate", value: 15, tone: "gray" },
];

export function ResearchPage() {
  useScrollReveal();

  return (
    <div className="site-shell">
      <Navbar />

      <header className="page-hero">
        <div className="page-hero-inner reveal reveal-up" data-reveal>
          <span className="section-eyebrow">Research Focus</span>
          <h1>Researching Philippine SMS Fraud</h1>
          <p>
            BantAI's underlying research spans the smishing threat landscape, multilingual NLP for
            code-switched Filipino text, and unsupervised methods for surfacing coordinated
            campaigns from independently reported messages.
          </p>
        </div>
      </header>

      <section className="section">
        <div className="research-grid reveal-stagger" data-reveal>
          {HIGHLIGHTS.map((item) => (
            <article key={item.title} className="research-card">
              <span className="badge gray">{item.tag}</span>
              <strong>{item.title}</strong>
              <p>{item.abstract}</p>
              <a href="#" className="panel-link">Read more &rarr;</a>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeader
          eyebrow="Dataset"
          title="Dataset Statistics"
          subtitle="Labeled samples collected and annotated for model training and evaluation."
        />
        <div className="dataset-grid reveal reveal-up" data-reveal>
          <div className="dataset-count-card">
            <strong>14,892+</strong>
            <span>Labeled SMS Samples</span>
          </div>
          <div className="dataset-breakdown">
            <div className="breakdown-block">
              <span className="section-label">Language Distribution</span>
              {LANGUAGE_DISTRIBUTION.map((row) => (
                <div key={row.label} className="breakdown-row">
                  <span>{row.label}</span>
                  <div className="rail"><span className={row.tone} style={{ width: `${row.value}%` }} /></div>
                  <strong>{row.value}%</strong>
                </div>
              ))}
            </div>
            <div className="breakdown-block">
              <span className="section-label">Threat Category Distribution</span>
              {THREAT_DISTRIBUTION.map((row) => (
                <div key={row.label} className="breakdown-row">
                  <span>{row.label}</span>
                  <div className="rail"><span className={row.tone} style={{ width: `${row.value}%` }} /></div>
                  <strong>{row.value}%</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="citation-card reveal reveal-up" data-reveal>
          <span className="section-label">Citation &amp; References</span>
          <p className="citation-entry">
            Castro, A., De Castro, D., &amp; Mendoza, R. (2026). <em>BantAI: Multilingual Campaign
            Intelligence for Philippine SMS Smishing Detection</em>. Undergraduate Thesis, College of
            Information Technology and Engineering, De La Salle Lipa.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
