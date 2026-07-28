export function PhoneMockup() {
  return (
    <div className="phone-mockup-wrap">
      <div className="phone-mockup-glow" />
      <div className="phone-mockup">
        <div className="phone-mockup-notch" />
        <div className="phone-mockup-screen">
          <div className="phone-mockup-statusbar">
            <span>9:41</span>
            <span className="phone-mockup-signal" />
          </div>
          <div className="phone-mockup-appbar">
            <span className="phone-mockup-appbar-dot" />
            BantAI
          </div>
          <div className="phone-mockup-alert">
            <div className="phone-mockup-alert-head">
              <span className="dot red" />
              <strong>Smishing Detected</strong>
              <span className="badge red">97%</span>
            </div>
            <p>"Your GCash account has been temporarily suspended. Verify now: gcash-verify.ph/..."</p>
          </div>
          <div className="phone-mockup-msg safe">
            <span className="dot" style={{ background: "var(--green)" }} />
            <div>
              <strong>Globe Telecom</strong>
              <small>Your monthly bill is now available.</small>
            </div>
          </div>
          <div className="phone-mockup-msg safe">
            <span className="dot" style={{ background: "var(--green)" }} />
            <div>
              <strong>BDO Alert</strong>
              <small>Your OTP is 482913. Valid for 5 mins.</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
