<script lang="ts">
  interface Props {
    /** Called when the user clicks the back button. */
    onBack: () => void
  }

  let { onBack }: Props = $props()
</script>

<div class="tos-screen">
  <div class="tos-header">
    <button class="back-btn" type="button" onclick={onBack} aria-label="Back">
      ← Back
    </button>
    <h1 class="tos-title">Terms of Service</h1>
  </div>

  <div class="tos-body">
    <p class="effective-date">Effective date: 1 January 2025</p>

    <p class="intro">
      Please read these Terms of Service ("Terms") carefully before playing Recall Rogue ("the
      Game"). By creating an account or using the Game in any way, you agree to be bound by these
      Terms. If you do not agree, do not use the Game.
    </p>

    <!-- Section 1 -->
    <section class="tos-section">
      <h2 class="section-heading">1. Acceptance of Terms</h2>
      <p>
        These Terms form a legally binding agreement between you and the indie developer of Terra
        Gacha. Your continued use of the Game constitutes your acceptance of any future amendments
        to these Terms. We will notify you of material changes via in-game notification or email.
      </p>
    </section>

    <!-- Section 2 -->
    <section class="tos-section">
      <h2 class="section-heading">2. User Accounts and Responsibilities</h2>
      <p>
        You must provide accurate information when registering. You are responsible for maintaining
        the confidentiality of your account credentials and for all activity that occurs under your
        account.
      </p>
      <ul>
        <li>You must be at least 13 years old to create an account (or have verifiable parental consent if under 13).</li>
        <li>One account per person. Creating multiple accounts to circumvent restrictions is prohibited.</li>
        <li>You must notify us immediately if you suspect unauthorised access to your account.</li>
        <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
      </ul>
    </section>

    <!-- Section 3 -->
    <section class="tos-section">
      <h2 class="section-heading">3. Content and Intellectual Property</h2>
      <p>
        All game content — including but not limited to graphics, text, music, code, quiz facts,
        and the Recall Rogue name — is owned by or licensed to the developer and is protected by
        copyright and other intellectual property laws.
      </p>
      <p>
        We grant you a personal, non-exclusive, non-transferable, revocable licence to play the
        Game for personal, non-commercial purposes. You may not:
      </p>
      <ul>
        <li>Copy, modify, distribute, or create derivative works from the Game.</li>
        <li>Reverse-engineer or decompile the Game's software.</li>
        <li>Use any part of the Game for commercial purposes without written permission.</li>
      </ul>
    </section>

    <!-- Section 4 -->
    <section class="tos-section">
      <h2 class="section-heading">4. Prohibited Conduct</h2>
      <p>While using the Game, you must not:</p>
      <ul>
        <li>Cheat, exploit bugs, or use unauthorised third-party software to gain an unfair advantage.</li>
        <li>Harass, threaten, or abuse other players in any shared or social feature.</li>
        <li>Transmit malware, spam, or other harmful content.</li>
        <li>Attempt to gain unauthorised access to our servers or another player's account.</li>
        <li>Violate any applicable laws or regulations in connection with your use of the Game.</li>
        <li>Impersonate the developer, another player, or any other person.</li>
      </ul>
    </section>

    <!-- Section 5 -->
    <section class="tos-section">
      <h2 class="section-heading">5. Disclaimers and Limitation of Liability</h2>
      <p>
        The Game is provided "as is" and "as available" without warranties of any kind, either
        express or implied. We do not warrant that the Game will be uninterrupted, error-free, or
        free of harmful components.
      </p>
      <p>
        To the maximum extent permitted by applicable law, our total liability to you for any
        claims arising from your use of the Game shall not exceed the amount you paid to us in the
        12 months preceding the claim, or USD $10, whichever is greater.
      </p>
      <p>
        We are not liable for any indirect, incidental, special, consequential, or punitive
        damages, including loss of data, loss of profits, or loss of goodwill.
      </p>
    </section>

    <!-- Section 6 -->
    <section class="tos-section">
      <h2 class="section-heading">6. Termination</h2>
      <p>
        You may stop using the Game and request deletion of your account at any time by contacting
        us at <a href="mailto:privacy@terragacha.com" class="link">privacy@terragacha.com</a>.
      </p>
      <p>
        We may suspend or terminate your access at any time if you violate these Terms, without
        prior notice. Upon termination, your licence to use the Game ends immediately and we may
        delete your account data in accordance with our Privacy Policy.
      </p>
    </section>

    <!-- Section 7 -->
    <section class="tos-section">
      <h2 class="section-heading">7. Governing Law</h2>
      <p>
        These Terms are governed by and construed in accordance with applicable law. Any disputes
        shall be resolved through good-faith negotiation in the first instance, and thereafter
        through binding arbitration or the courts of the developer's jurisdiction, as permitted
        by local law.
      </p>
    </section>

    <!-- Section 8 -->
    <section class="tos-section">
      <h2 class="section-heading">8. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. When we make material changes, we will update
        the effective date at the top and notify you through the Game or by email. Continued use
        of the Game after changes take effect constitutes acceptance of the updated Terms.
      </p>
    </section>

    <!-- Section 9 -->
    <section class="tos-section">
      <h2 class="section-heading">9. Contact</h2>
      <p>If you have questions about these Terms, please contact us:</p>
      <address class="contact-address">
        Recall Rogue Support<br />
        <a href="mailto:privacy@terragacha.com" class="link">privacy@terragacha.com</a>
      </address>
    </section>

    <div class="tos-footer">
      <button class="back-btn-bottom" type="button" onclick={onBack}>
        ← Back
      </button>
    </div>
  </div>
</div>

<style>
  .tos-screen {
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

  .tos-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgba(233, 69, 96, 0.2);
    background: #16213e;
    flex-shrink: 0;
  }

  .tos-title {
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

  .tos-body {
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
    margin-bottom: 0.75rem;
  }

  .intro {
    font-size: 0.875rem;
    line-height: 1.7;
    color: rgba(238, 238, 238, 0.85);
    margin-bottom: 1.5rem;
    padding: 0.75rem 1rem;
    background: rgba(233, 69, 96, 0.06);
    border-left: 3px solid rgba(233, 69, 96, 0.5);
    border-radius: 0 8px 8px 0;
  }

  .tos-section {
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

  .tos-section p,
  .tos-section address {
    font-size: 0.875rem;
    line-height: 1.7;
    color: rgba(238, 238, 238, 0.85);
    margin: 0 0 0.75rem 0;
  }

  .tos-section ul {
    margin: 0 0 0.75rem 1.25rem;
    padding: 0;
  }

  .tos-section li {
    font-size: 0.875rem;
    line-height: 1.7;
    color: rgba(238, 238, 238, 0.85);
    margin-bottom: 0.375rem;
  }

  .link {
    color: rgba(78, 205, 196, 0.9);
    text-decoration: underline;
  }

  .link:hover {
    color: #4ecdc4;
  }

  .contact-address {
    font-style: normal;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-bottom: 0.75rem !important;
  }

  .tos-footer {
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
