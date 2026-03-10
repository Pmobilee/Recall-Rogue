<script lang="ts">
  interface Props {
    /** Called when the user clicks the back button. */
    onBack: () => void
  }

  let { onBack }: Props = $props()
</script>

<div class="policy-screen">
  <div class="policy-header">
    <button class="back-btn" type="button" onclick={onBack} aria-label="Back">
      ← Back
    </button>
    <h1 class="policy-title">Privacy Policy</h1>
  </div>

  <div class="policy-body">
    <p class="effective-date">Effective date: 1 January 2025</p>

    <!-- Section 1 -->
    <section class="policy-section">
      <h2 class="section-heading">1. Introduction</h2>
      <p>
        Recall Rogue ("the Game") is developed and operated by an independent ("indie") developer.
        This Privacy Policy explains what personal data we collect when you play the Game, how we
        use it, and what rights you have over it. By creating an account or playing the Game you
        agree to the practices described here.
      </p>
    </section>

    <!-- Section 2 -->
    <section class="policy-section">
      <h2 class="section-heading">2. Data We Collect</h2>
      <p>We collect the following categories of information:</p>
      <ul>
        <li>
          <strong>Account data</strong> — display name, email address, and a hashed password when
          you register. Guest players are identified by a randomly generated ID only.
        </li>
        <li>
          <strong>Gameplay data</strong> — dive history, minerals collected, facts learned, quiz
          answers, streak counts, and other in-game progress stored in your save file.
        </li>
        <li>
          <strong>Analytics</strong> — anonymised event data described in Section 3. No
          personally identifiable information (PII) is attached to these events.
        </li>
        <li>
          <strong>Device data</strong> — operating system, browser/app version, screen resolution,
          and locale, collected automatically to ensure compatibility and diagnose crashes.
        </li>
      </ul>
    </section>

    <!-- Section 3 -->
    <section class="policy-section">
      <h2 class="section-heading">3. Analytics Events</h2>
      <p>
        We record up to ten anonymised event types to understand how the Game is played and to
        improve future updates. These events are:
      </p>
      <ol>
        <li>Session start / end</li>
        <li>Dive started</li>
        <li>Dive completed (depth reached, biome)</li>
        <li>Quiz answered (correct/incorrect, no fact text)</li>
        <li>Fact learned / sold</li>
        <li>Oxygen tank purchased</li>
        <li>Tutorial step completed</li>
        <li>Interest category selected</li>
        <li>Login calendar day claimed</li>
        <li>App crash / error (stack trace only, no user data)</li>
      </ol>
      <p>
        All analytics events are stripped of PII before transmission and are retained for a
        maximum of <strong>90 days</strong>.
      </p>
    </section>

    <!-- Section 4 -->
    <section class="policy-section">
      <h2 class="section-heading">4. How We Use Your Data</h2>
      <ul>
        <li>Sync your game progress across devices and restore save data.</li>
        <li>Display leaderboards (username and score only; disabled for under-13 players).</li>
        <li>Analyse aggregate gameplay patterns to improve balance and content.</li>
        <li>Send optional push notifications about streak reminders and updates (opt-in only).</li>
        <li>Diagnose crashes and fix bugs.</li>
      </ul>
      <p>
        <strong>We do not sell your data</strong> to any third party. We do not use your data for
        targeted advertising.
      </p>
    </section>

    <!-- Section 5 -->
    <section class="policy-section">
      <h2 class="section-heading">5. Children's Privacy (COPPA)</h2>
      <p>
        Players who identify as under 13 years of age receive a filtered content experience
        ("kid" age rating). We additionally apply the following protections for these players:
      </p>
      <ul>
        <li>No public leaderboard participation.</li>
        <li>No optional marketing communications.</li>
        <li>No behavioural advertising or data sharing with ad networks.</li>
        <li>Minimal data collection — only what is necessary to run the Game.</li>
      </ul>
      <p>
        If we discover that we have inadvertently collected personal information from a child under
        13 without verifiable parental consent, we will delete that information promptly. Parents
        or guardians may contact us at <a href="mailto:privacy@terragacha.com" class="link">privacy@terragacha.com</a> to request deletion.
      </p>
    </section>

    <!-- Section 6 -->
    <section class="policy-section">
      <h2 class="section-heading">6. Data Retention</h2>
      <table class="retention-table">
        <thead>
          <tr>
            <th>Data type</th>
            <th>Retention period</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Active account data</td>
            <td>Lifetime of account</td>
          </tr>
          <tr>
            <td>Deleted account data</td>
            <td>Purged within 30 days of deletion request</td>
          </tr>
          <tr>
            <td>Analytics events</td>
            <td>90 days (rolling)</td>
          </tr>
          <tr>
            <td>Backup snapshots</td>
            <td>60 days</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Section 7 -->
    <section class="policy-section">
      <h2 class="section-heading">7. Your Rights (GDPR)</h2>
      <p>If you are located in the European Economic Area or the UK, you have the right to:</p>
      <ul>
        <li><strong>Access</strong> — request a copy of the personal data we hold about you.</li>
        <li><strong>Correct</strong> — request correction of inaccurate data.</li>
        <li><strong>Delete</strong> — request erasure of your account and associated data.</li>
        <li><strong>Portability</strong> — receive your data in a machine-readable format.</li>
        <li><strong>Withdraw consent</strong> — withdraw any consent you previously gave at any time.</li>
      </ul>
      <p>
        To exercise any of these rights, contact us at
        <a href="mailto:privacy@terragacha.com" class="link">privacy@terragacha.com</a>.
        We will respond within 30 days.
      </p>
    </section>

    <!-- Section 8 -->
    <section class="policy-section">
      <h2 class="section-heading">8. Security</h2>
      <p>We take the following measures to protect your data:</p>
      <ul>
        <li>Passwords are hashed using <strong>PBKDF2</strong> with a unique salt per account. We never store plaintext passwords.</li>
        <li>All data in transit is encrypted using <strong>HTTPS / TLS 1.2+</strong>.</li>
        <li>Authentication tokens expire after <strong>15 minutes</strong> and are rotated on each use.</li>
        <li>Access to production data is restricted to authorised personnel only.</li>
      </ul>
      <p>
        No system is 100% secure. If you discover a security vulnerability, please disclose it
        responsibly to <a href="mailto:privacy@terragacha.com" class="link">privacy@terragacha.com</a>.
      </p>
    </section>

    <!-- Section 9 -->
    <section class="policy-section">
      <h2 class="section-heading">9. Contact</h2>
      <p>
        For privacy-related enquiries, data access requests, or concerns, please write to:
      </p>
      <address class="contact-address">
        Recall Rogue Privacy Team<br />
        <a href="mailto:privacy@terragacha.com" class="link">privacy@terragacha.com</a>
      </address>
      <p>We aim to respond to all privacy requests within <strong>30 days</strong>.</p>
    </section>

    <div class="policy-footer">
      <button class="back-btn-bottom" type="button" onclick={onBack}>
        ← Back
      </button>
    </div>
  </div>
</div>

<style>
  .policy-screen {
    pointer-events: auto;
    position: fixed;
    inset: 0;
    background: #1a1a2e;
    z-index: 200;
    display: flex;
    flex-direction: column;
    font-family: 'Courier New', monospace;
    color: #eee;
  }

  .policy-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgba(233, 69, 96, 0.2);
    background: #16213e;
    flex-shrink: 0;
  }

  .policy-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #eee;
    margin: 0;
  }

  .back-btn {
    background: none;
    border: none;
    color: rgba(78, 205, 196, 0.9);
    font: inherit;
    font-size: 0.875rem;
    cursor: pointer;
    padding: 0.5rem 0;
    min-height: 44px;
    display: flex;
    align-items: center;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .back-btn:hover {
    color: #4ecdc4;
  }

  .policy-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem 1.25rem;
    max-width: 720px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }

  .effective-date {
    color: rgba(238, 238, 238, 0.5);
    font-size: 0.8rem;
    margin-bottom: 1.5rem;
  }

  .policy-section {
    margin-bottom: 2rem;
  }

  .section-heading {
    font-size: 1rem;
    font-weight: 700;
    color: #e94560;
    margin: 0 0 0.75rem 0;
    padding-bottom: 0.4rem;
    border-bottom: 1px solid rgba(233, 69, 96, 0.2);
  }

  .policy-section p,
  .policy-section address {
    font-size: 0.875rem;
    line-height: 1.7;
    color: rgba(238, 238, 238, 0.85);
    margin: 0 0 0.75rem 0;
  }

  .policy-section ul,
  .policy-section ol {
    margin: 0 0 0.75rem 1.25rem;
    padding: 0;
  }

  .policy-section li {
    font-size: 0.875rem;
    line-height: 1.7;
    color: rgba(238, 238, 238, 0.85);
    margin-bottom: 0.375rem;
  }

  .policy-section strong {
    color: #eee;
    font-weight: 700;
  }

  .link {
    color: rgba(78, 205, 196, 0.9);
    text-decoration: underline;
  }

  .link:hover {
    color: #4ecdc4;
  }

  .retention-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    margin-bottom: 0.75rem;
  }

  .retention-table th,
  .retention-table td {
    padding: 0.5rem 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    text-align: left;
    color: rgba(238, 238, 238, 0.85);
  }

  .retention-table th {
    background: rgba(233, 69, 96, 0.1);
    color: #eee;
    font-weight: 700;
  }

  .retention-table tr:nth-child(even) td {
    background: rgba(255, 255, 255, 0.03);
  }

  .contact-address {
    font-style: normal;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-bottom: 0.75rem !important;
  }

  .policy-footer {
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    margin-top: 1rem;
  }

  .back-btn-bottom {
    background: none;
    border: 1px solid rgba(78, 205, 196, 0.4);
    border-radius: 8px;
    color: rgba(78, 205, 196, 0.9);
    font: inherit;
    font-size: 0.875rem;
    cursor: pointer;
    padding: 0.6rem 1.25rem;
    min-height: 44px;
  }

  .back-btn-bottom:hover {
    background: rgba(78, 205, 196, 0.08);
  }
</style>
