'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { runChecks } from '../lib/heuristics';

const EXAMPLES = [
  ['Fake electricity cutoff', 'FINAL NOTICE: Your electricity service will be disconnected within 2 hours because your meter verification is pending. Call this number immediately and pay a Rs 10 reconnection fee at http://bijli-update-help.xyz. After payment, enter the OTP you receive to confirm your account. Do not visit the local office; this offer is only available by phone today.'],
  ['Fake UPI collect request', 'You have a pending UPI collect request of Rs 2,000 for a refund that will expire in 10 minutes. Open your payment app, approve the request, and enter your UPI PIN to receive the money. The sender says the refund cannot be processed another way and asks you to act immediately.'],
  ['Telegram part-time job', 'Part-time Telegram job: earn Rs 5,000 every day by liking and rating videos from home. No experience is needed, and payment is guaranteed after your first tasks. Pay a Rs 500 registration fee to unlock the work, then send your bank details for salary setup. Do not tell your family or contact the company outside this chat.'],
  ['Fake KYC alert', 'FINAL ALERT: Your SBI account will be blocked today because KYC verification is pending. Update it immediately at http://sbi-kyc-verify.xyz/login or your account may be suspended. After signing in, share the OTP you receive to confirm your identity. Do not call your branch because the verification window closes in 30 minutes.'],
];
const LABEL = { scam: 'Likely scam', suspicious: 'Be cautious', safe: 'No obvious red flags' };
const FAMILY_COPY = {
  en: {
    scam: 'Do not send money or share an OTP, password, or UPI PIN.',
    suspicious: 'Pause. Do not click links or share codes until you verify the sender.',
    safe: 'No clear warning signs found. Verify unexpected money requests directly.',
  },
  hi: {
    scam: 'पैसे न भेजें और OTP, पासवर्ड या UPI PIN किसी से साझा न करें।',
    suspicious: 'रुकें। भेजने वाले की पुष्टि किए बिना लिंक न खोलें और कोड साझा न करें।',
    safe: 'कोई साफ़ खतरे का संकेत नहीं मिला। पैसों से जुड़े अनपेक्षित अनुरोध की सीधे पुष्टि करें।',
  },
  ta: {
    scam: 'பணம் அனுப்பாதீர்கள். OTP, கடவுச்சொல் அல்லது UPI PIN-ஐ யாரிடமும் பகிராதீர்கள்.',
    suspicious: 'சற்று நிறுத்துங்கள். அனுப்புநரை உறுதிப்படுத்தும் வரை இணைப்பைத் திறக்காதீர்கள்; குறியீடுகளைப் பகிராதீர்கள்.',
    safe: 'தெளிவான ஆபத்து அறிகுறிகள் இல்லை. எதிர்பாராத பணக் கோரிக்கையை நேரடியாக உறுதிப்படுத்துங்கள்.',
  },
};
const FAMILY_LABEL = {
  en: { scam: 'Likely scam', suspicious: 'Be cautious', safe: 'No obvious red flags' },
  hi: { scam: 'संभवतः धोखाधड़ी', suspicious: 'सावधान रहें', safe: 'कोई साफ़ खतरे का संकेत नहीं' },
  ta: { scam: 'மோசடியாக இருக்கலாம்', suspicious: 'எச்சரிக்கையாக இருங்கள்', safe: 'வெளிப்படையான ஆபத்து அறிகுறி இல்லை' },
};
const REPORT_COPY = {
  en: { eyebrow: 'INDIA · OFFICIAL REPORTING', title: 'If money was sent, act now', step1: 'Call the national cyber fraud helpline 1930 as soon as possible.', step2: 'Contact your bank or payment app through its official app or number. Ask them to secure the account and advise on the transaction.', step3: 'Keep the transaction ID, time, screenshots, and messages.', step4: 'File or follow up at', call: 'Call 1930' },
  hi: { eyebrow: 'भारत · आधिकारिक शिकायत', title: 'पैसे भेज दिए हैं? अभी कार्रवाई करें', step1: 'जितनी जल्दी हो सके राष्ट्रीय साइबर धोखाधड़ी हेल्पलाइन 1930 पर कॉल करें।', step2: 'अपने बैंक या पेमेंट ऐप से उसके आधिकारिक ऐप या नंबर पर संपर्क करें। खाते को सुरक्षित करने और लेन-देन के बारे में सलाह मांगें।', step3: 'लेन-देन ID, समय, स्क्रीनशॉट और संदेश संभालकर रखें।', step4: 'यहाँ शिकायत दर्ज करें या आगे की जानकारी दें:', call: '1930 पर कॉल करें' },
  ta: { eyebrow: 'இந்தியா · அதிகாரப்பூர்வ புகார்', title: 'பணம் அனுப்பிவிட்டீர்களா? உடனே செயல்படுங்கள்', step1: 'தேசிய இணைய நிதி மோசடி உதவி எண்ணான 1930-ஐ விரைவாக அழைக்கவும்.', step2: 'உங்கள் வங்கி அல்லது கட்டணச் செயலியை அதன் அதிகாரப்பூர்வ செயலி அல்லது எண்ணில் தொடர்புகொள்ளவும். கணக்கைப் பாதுகாக்கவும் பரிவர்த்தனை குறித்து ஆலோசனை பெறவும் கேளுங்கள்.', step3: 'பரிவர்த்தனை ID, நேரம், திரைப்பிடிப்புகள் மற்றும் செய்திகளைச் சேமிக்கவும்.', step4: 'இங்கே புகார் அளிக்கவும் அல்லது தொடர்ந்து தகவல் வழங்கவும்:', call: '1930-ஐ அழைக்கவும்' },
};

function Icon({ name, size = 22 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  const paths = {
    pause: <><rect x="5" y="4" width="5" height="16" rx="2" fill="currentColor" stroke="none"/><rect x="14" y="4" width="5" height="16" rx="2" fill="currentColor" stroke="none"/></>,
    arrow: <><path d="M4 12h15M13 6l6 6-6 6"/></>,
    message: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.7-3.2A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 11h8M8 14h5"/></>,
    scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10M12 7v10"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1L11 4.8"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>,
    speaker: <><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    phone: <><path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M11 18h2"/></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>,
  };
  return <svg {...common}>{paths[name] || paths.spark}</svg>;
}

function Brand() {
  return <span className="brand-mark"><span className="brand-icon"><Icon name="pause" size={15} /></span><span>pause<span className="brand-dot">.</span></span></span>;
}

function Capability({ icon, number, title, children, note }) {
  return <article className="capability-row">
    <span className="capability-number">{number}</span><span className="capability-icon"><Icon name={icon} size={19} /></span>
    <div className="capability-copy"><h3>{title}</h3><p>{children}</p>{note && <span className="capability-note">{note}</span>}</div>
  </article>;
}

function ResultScreen({ res, familyMode, setFamilyMode, country, lang, onBack, onSpeak, onCopy, copied, whatsappUrl }) {
  const reportCopy = REPORT_COPY[res?.language || lang] || REPORT_COPY.en;
  return <main className="result-page">
    <div className="result-page-nav"><button className="back-link" onClick={onBack}>← Back to your check</button><button className={`family-toggle ${familyMode ? 'is-on' : ''}`} aria-pressed={familyMode} onClick={() => setFamilyMode(value => !value)}><Icon name="speaker" size={15} /> Family mode {familyMode ? 'On' : 'Off'}</button></div>
    <header className="result-page-heading"><span className="eyebrow">YOUR CHECK RESULT</span><h1>Here’s what Pause found.</h1><p>Review the signals and next steps. This is a second opinion, not a guarantee.</p></header>
    <section className={`result-card result-${res.verdict} ${familyMode ? 'family-mode' : ''}`} aria-live="polite">
      <div className="result-title"><span className="result-symbol"><Icon name={res.verdict === 'safe' ? 'check' : 'shield'} size={22} /></span><div><span className="eyebrow">CHECK COMPLETE</span><h2>{LABEL[res.verdict] || 'Check complete'}</h2></div><span className="result-mode">{res.mode === 'ai+checks' ? 'AI + link checks' : 'Pattern checks'}</span></div>
      {familyMode && <div className="family-directive"><span className="eyebrow">PLEASE READ THIS FIRST</span><strong>{FAMILY_COPY[res.language || lang]?.[res.verdict] || FAMILY_COPY.en[res.verdict]}</strong></div>}
      <p className="result-headline">{res.headline}</p>
      <div className="meter"><div style={{ width: `${Math.max(0, Math.min(100, res.score || 0))}%` }} /></div><div className="meter-caption"><span>Local pattern signals</span><span>{res.score || 0}/100</span></div><p className="meter-note">This number reflects local pattern and link checks only. AI can flag additional warning signs; the score is not a probability or AI confidence.</p>
      {res.reasons?.length > 0 && <div className="result-block"><h3>What stood out</h3><ul>{res.reasons.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      {res.evidence?.length > 0 && <div className="result-block"><h3>Link investigation</h3><ul>{res.evidence.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      {country === 'IN' && res.verdict !== 'safe' && <div className="reporting-card"><div className="reporting-heading"><span className="reporting-icon"><Icon name="shield" size={18} /></span><div><span className="eyebrow">{reportCopy.eyebrow}</span><h3>{reportCopy.title}</h3></div></div><ol><li>{reportCopy.step1}</li><li>{reportCopy.step2}</li><li>{reportCopy.step3}</li><li>{reportCopy.step4} <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">cybercrime.gov.in</a>.</li></ol><a className="call-1930" href="tel:1930"><Icon name="phone" size={16} /> {reportCopy.call}</a></div>}
      <div className="result-block"><h3>What you can do</h3><ul>{res.nextSteps?.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
      <div className="result-actions">{familyMode ? <a className="whatsapp-button" href={whatsappUrl} target="_blank" rel="noreferrer"><Icon name="message" size={17} /> Share to WhatsApp</a> : <><button className="secondary-button" onClick={onSpeak}><Icon name="speaker" size={17} /> Read aloud</button><button className="secondary-button" onClick={onCopy}><Icon name="message" size={17} /> {copied ? 'Link copied' : 'Share result'}</button><span>Shared links don’t include the original message.</span></>}</div>
      <p className="result-caveat">Pause is a second opinion, not a guarantee. Verify important requests through official channels.</p>
    </section>
  </main>;
}

export default function Home() {
  const [page, setPage] = useState('start');
  const [aiConfigured, setAiConfigured] = useState(null);
  const [rateLimitConfigured, setRateLimitConfigured] = useState(null);
  const [usageLimitMode, setUsageLimitMode] = useState(null);
  const [text, setText] = useState(''); const [screenshotNote, setScreenshotNote] = useState(''); const [image, setImage] = useState(null); const [imageName, setImageName] = useState('');
  const [country, setCountry] = useState('IN'); const [lang, setLang] = useState('en'); const [qr, setQr] = useState(''); const [loading, setLoading] = useState(false);
  const [inputMode, setInputMode] = useState('text'); const [linkInput, setLinkInput] = useState(''); const [familyMode, setFamilyMode] = useState(false);
  const [res, setRes] = useState(null); const [err, setErr] = useState(''); const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);
  const currentText = inputMode === 'link' ? linkInput : inputMode === 'screenshot' ? screenshotNote : text;
  const linkHints = inputMode === 'link' && linkInput.trim() ? runChecks(linkInput).reasons : [];
  const canCheck = inputMode === 'link' ? Boolean(linkInput.trim()) : inputMode === 'screenshot' ? Boolean(image || screenshotNote.trim()) : Boolean(text.trim());

  useEffect(() => {
    let current = true;
    fetch('/api/status').then(response => response.ok ? response.json() : null).then(data => {
      if (current && data) {
        setAiConfigured(Boolean(data.aiConfigured));
        setRateLimitConfigured(Boolean(data.rateLimitConfigured));
        setUsageLimitMode(data.rateLimitMode || 'unknown');
      }
    }).catch(() => { if (current) { setAiConfigured(false); setRateLimitConfigured(false); setUsageLimitMode('unknown'); } });
    return () => { current = false; };
  }, []);

  function navigate(next) {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function onFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) { setErr('Choose a PNG, JPG, or WebP screenshot.'); e.target.value = ''; return; }
    if (f.size > 3 * 1024 * 1024) { setErr('Image is too big. Please use one under 3 MB.'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result); setImageName(f.name); setErr(''); setQr(''); setScreenshotNote('');
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas'); const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        const context = canvas.getContext('2d'); context.drawImage(img, 0, 0, canvas.width, canvas.height);
        const code = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (code?.data) { setQr(code.data); setScreenshotNote(current => (current ? current + '\n' : '') + 'Link from QR code: ' + code.data); }
      };
      img.src = reader.result;
    };
    reader.onerror = () => setErr('We could not read that image. Please try another one.');
    reader.readAsDataURL(f);
  }
  async function check() {
    if (inputMode === 'link') {
      try { const parsed = new URL(/^https?:\/\//i.test(linkInput) ? linkInput : `https://${linkInput}`); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); }
      catch { setErr('Enter a valid web address, such as https://example.com'); return; }
    }
    setLoading(true); setErr(''); setRes(null);
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: currentText, image: inputMode === 'screenshot' ? image : null, country, lang }) });
      const data = await response.json();
      if (!response.ok) setErr(data.error || 'We could not check that message.'); else { setRes(data); setPage('result'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    } catch { setErr('Network error. Please try again.'); }
    finally { setLoading(false); }
  }
  function shareUrl() {
    const payload = { v: res.verdict, h: res.headline, r: res.reasons, n: res.nextSteps };
    return `${location.origin}/r?d=${encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))))}`;
  }
  function familyWhatsAppUrl() {
    const language = res?.language || lang;
    const label = FAMILY_LABEL[language]?.[res.verdict] || FAMILY_LABEL.en[res.verdict];
    const closing = {
      en: 'Please verify through the company’s official app or phone number.',
      hi: 'कृपया कंपनी के आधिकारिक ऐप या फोन नंबर से पुष्टि करें।',
      ta: 'நிறுவனத்தின் அதிகாரப்பூர்வ செயலி அல்லது தொலைபேசி எண்ணில் உறுதிப்படுத்துங்கள்.',
    }[language] || 'Please verify through the company’s official app or phone number.';
    const message = [
      `Pause: ${label || 'Please be careful'}`,
      FAMILY_COPY[language]?.[res.verdict] || FAMILY_COPY.en[res.verdict],
      ...(res.reasons || []).slice(0, 2).map(reason => `• ${reason}`),
      ...(res.nextSteps || []).slice(0, 2).map(step => `• ${step}`),
      closing,
    ].join('\n');
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }
  async function copy() {
    try { await navigator.clipboard.writeText(shareUrl()); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setErr('Could not copy the link. Check your browser permissions.'); }
  }
  function speak() {
    if (!res || !('speechSynthesis' in window)) { setErr('Read aloud is not supported in this browser.'); return; }
    const utterance = new SpeechSynthesisUtterance([res.headline, ...res.reasons, ...res.nextSteps].join('. '));
    utterance.lang = { en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN' }[res.language || lang] || 'en-IN';
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
  }
  function loadExample(example) { setText(example[1]); setScreenshotNote(''); setLinkInput(''); setInputMode('text'); setRes(null); setErr(''); setImage(null); setImageName(''); navigate('check'); }
  function clearImage() { setImage(null); setImageName(''); setScreenshotNote(''); setQr(''); if (fileRef.current) fileRef.current.value = ''; }

  return <div className="app-shell">
    <header className="site-header">
      <button className="brand-button" onClick={() => navigate('start')} aria-label="Pause home"><Brand /></button>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={page === 'start' ? 'nav-active' : ''} onClick={() => navigate('start')}>Get started</button>
        <button className={page !== 'start' ? 'nav-active' : ''} onClick={() => navigate('check')}>Check a message</button>
      </nav>
      <button className="header-cta" onClick={() => navigate('check')}>Open checker <Icon name="arrow" size={16} /></button>
    </header>

    {page === 'start' ? <main className="start-page">
      <section className="start-hero">
        <div className="hero-centered">
          <span className="eyebrow"><span className="eyebrow-dot" /> A SECOND OPINION BEFORE YOU ACT</span>
          <h1>Before you act,<br /><em>take a pause.</em></h1>
          <p className="hero-lede">Check a message, screenshot, or link. See what stands out, then decide your next move with a little more clarity.</p>
          <div className="hero-actions"><button className="primary-button" onClick={() => navigate('check')}>Check something suspicious <Icon name="arrow" size={18} /></button><span><Icon name="lock" size={16} /> No account needed</span></div>
        </div>
        <div className="hero-capability-rail"><span><strong>01</strong> Paste a message</span><i /><span><strong>02</strong> Inspect the signs</span><i /><span><strong>03</strong> Choose what to do</span></div>
      </section>

      <section className="capabilities-section" aria-labelledby="capabilities-title">
        <div className="section-heading"><div><span className="eyebrow">WHAT PAUSE CAN DO</span><h2 id="capabilities-title">More than a yes or no.</h2></div><p>Get a clearer picture of the message, the link, and the next safe step.</p></div>
        <div className="capability-grid">
          <Capability icon="message" number="01" title="Check messages">Paste an SMS, chat, email, or link. Pattern checks and Groq AI, when enabled, can help identify suspicious language.</Capability>
          <Capability icon="scan" number="02" title="Inspect screenshots & QR codes">Upload a screenshot for analysis. Pause also detects QR code links in the image and includes them in the check.</Capability>
          <Capability icon="link" number="03" title="Investigate links">Inspect redirects and domain registration age. Google Safe Browsing can be enabled as an additional check.</Capability>
          <Capability icon="speaker" number="04" title="Use your language">Choose English, Hindi, or Tamil results, then use your browser’s built-in read-aloud voice.</Capability>
        </div>
        <div className="capability-footnote"><Icon name="spark" size={17} /><span>Pause combines message patterns, link signals, and AI when configured. Its score is a signal indicator, not a probability. When enabled, message text and screenshots are sent to Groq; shared links omit the original message.</span></div>
      </section>

      <section className="how-section">
        <div className="how-intro"><span className="eyebrow">A SIMPLE WAY TO PAUSE</span><h2>Check. Understand.<br /><em>Choose what to do.</em></h2><p>Pause gives you a second opinion. When something could put your money or accounts at risk, verify it through an official app or phone number.</p><button className="text-link" onClick={() => navigate('check')}>Try the message checker <Icon name="arrow" size={16} /></button></div>
        <div className="steps-list">
          <article className="step-row"><span className="step-index">1</span><div><h3>Share what you received</h3><p>Paste the message or add a screenshot. QR codes in the image are checked too.</p></div><Icon name="message" size={21} /></article>
          <article className="step-row"><span className="step-index">2</span><div><h3>See the warning signs</h3><p>Review the verdict, reasons, and any link evidence Pause could find.</p></div><Icon name="scan" size={21} /></article>
          <article className="step-row"><span className="step-index">3</span><div><h3>Decide your next step</h3><p>Use the suggested actions, or contact the organization through its official channel.</p></div><Icon name="shield" size={21} /></article>
        </div>
      </section>

      <section className="honesty-banner"><div className="honesty-icon"><Icon name="shield" size={22} /></div><div><strong>A helper, not a guarantee.</strong><p>Scams change quickly. Pause can miss a scam or flag a genuine message. Never share passwords, PINs, or one-time codes here.</p></div><button onClick={() => navigate('check')}>Check a message <Icon name="arrow" size={15} /></button></section>
    </main> : page === 'check' ? <main className="checker-page">
      <div className="checker-heading"><button className="back-link" onClick={() => navigate('start')}>← Get started</button><div className="checker-title-line"><div><span className="eyebrow">THE MESSAGE CHECKER</span><h1>Check before you respond.</h1></div><p>Paste a message, upload a screenshot, or enter a link. Pause will point out signals to consider—never share your password, PIN, or OTP.</p></div></div>
      <div className="checker-workspace">
      <section className="checker-panel" aria-label="Message checker">
        <div className="checker-controls"><button className={`family-toggle ${familyMode ? 'is-on' : ''}`} aria-pressed={familyMode} onClick={() => setFamilyMode(value => !value)}><Icon name="speaker" size={15} /> Family mode {familyMode ? 'On' : 'Off'}</button><label className="select-field"><span>Results in</span><select value={lang} onChange={e => setLang(e.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option><option value="ta">தமிழ்</option></select></label><label className="select-field"><span>Region</span><select value={country} onChange={e => setCountry(e.target.value)}><option value="IN">India</option><option value="OTHER">Other</option></select></label></div>
        <div className="input-tabs" role="tablist" aria-label="Choose what to check">
          <button role="tab" aria-selected={inputMode === 'text'} className={inputMode === 'text' ? 'selected' : ''} onClick={() => setInputMode('text')}><Icon name="message" size={16} /> Paste text</button>
          <button role="tab" aria-selected={inputMode === 'screenshot'} className={inputMode === 'screenshot' ? 'selected' : ''} onClick={() => setInputMode('screenshot')}><Icon name="scan" size={16} /> Screenshot</button>
          <button role="tab" aria-selected={inputMode === 'link'} className={inputMode === 'link' ? 'selected' : ''} onClick={() => setInputMode('link')}><Icon name="link" size={16} /> Enter a link</button>
        </div>
        {inputMode === 'text' && <>
          <label className="sr-only" htmlFor="message">Paste the message or link you want to check</label>
          <textarea id="message" value={text} onChange={e => setText(e.target.value)} placeholder="Paste the text of a message, email, or link here…" maxLength={4000} />
          <div className="composer-footer"><span>{text.length.toLocaleString()} / 4,000 characters</span><span>If AI is enabled, content is sent to Groq for analysis.</span></div>
        </>}
        {inputMode === 'screenshot' && <div className="screenshot-input">
          <div className="screenshot-drop"><span className="upload-symbol"><Icon name="scan" size={23} /></span><strong>{image ? imageName : 'Add a message screenshot'}</strong><span>PNG, JPG, or WebP · up to 3 MB · QR links are detected on your device</span><button className={`upload-button ${image ? 'file-added' : ''}`} onClick={() => fileRef.current?.click()}><Icon name={image ? 'check' : 'scan'} size={16} />{image ? 'Choose a different image' : 'Choose image'}</button></div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />
          {image && <button className="remove-button screenshot-remove" onClick={clearImage}>Remove screenshot</button>}
          <label className="sr-only" htmlFor="screenshot-note">Optional message text or context</label>
          <textarea id="screenshot-note" value={screenshotNote} onChange={e => setScreenshotNote(e.target.value)} placeholder="Optional: add context or text from the screenshot…" maxLength={4000} />
          <div className="composer-footer"><span>{screenshotNote.length.toLocaleString()} / 4,000 characters</span><span>If AI is enabled, the screenshot and text are sent to Groq.</span></div>
        </div>}
        {inputMode === 'link' && <div className="link-input-area">
          <label className="field-label" htmlFor="link-to-check">Suspicious web address</label>
          <input id="link-to-check" type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" value={linkInput} onChange={e => setLinkInput(e.target.value)} placeholder="https://example.com" />
          <p className="field-help">Pause follows checked redirects and looks up domain registration details when available.</p>
          {linkHints.length > 0 && <div className="link-hints"><strong>Quick pattern check</strong><ul>{linkHints.slice(0, 3).map((hint, index) => <li key={index}>{hint}</li>)}</ul><span>These signals are clues, not proof that a site is unsafe.</span></div>}
        </div>}
        {inputMode !== 'screenshot' && <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />}
        {inputMode === 'screenshot' && qr && <p className="qr-notice"><Icon name="scan" size={16} /> QR code found and its link was added to the message.</p>}
        {err && <p className="error-message" role="alert"><span>!</span>{err}</p>}
        <div className="checker-submit"><button className="primary-button" disabled={loading || !canCheck} onClick={check}>{loading ? <><span className="spinner" /> Checking the signs…</> : <>Check this {inputMode === 'link' ? 'link' : inputMode === 'screenshot' ? 'screenshot' : 'message'} <Icon name="arrow" size={18} /></>}</button><span><Icon name="lock" size={15} /> No account needed</span></div>
      </section>
      <aside className="checker-sidebar">
        <section className="sample-list"><div className="sidebar-heading"><span className="eyebrow">QUICK DEMOS</span><span>Click to try</span></div><div className="example-buttons">{EXAMPLES.map(example => <button key={example[0]} onClick={() => loadExample(example)}><span>{example[0]}</span><Icon name="arrow" size={14} /></button>)}</div></section>
        <section className={`ai-status ${aiConfigured === false || rateLimitConfigured === false ? 'ai-status-off' : ''}`} role="status"><span className="ai-status-dot" /><div><strong>{aiConfigured === null || rateLimitConfigured === null ? 'Checking AI and usage limits…' : rateLimitConfigured === false ? 'Shared usage limit not configured' : usageLimitMode === 'development' ? 'Local development mode' : aiConfigured ? 'Groq key and limit settings detected' : 'Groq AI is not configured'}</strong><p>{rateLimitConfigured === false ? <>Production checks stay disabled until you add <code>UPSTASH_REDIS_REST_URL</code> and <code>UPSTASH_REDIS_REST_TOKEN</code> in Vercel. Limits: 3 per minute, 10 per visitor daily, 100 total daily.</> : usageLimitMode === 'development' ? 'Local development does not enforce usage quotas. Production requests are capped at 3 per minute, 10 per visitor daily, and 100 total daily.' : aiConfigured === false ? <>Text checks use local patterns only. Add <code>GROQ_API_KEY</code> to <code>.env.local</code> and restart Next.js.</> : aiConfigured ? 'Production caps: 3 per minute, 10 per visitor daily, 100 total daily. Settings are detected but service connectivity is only checked when you submit.' : 'Checking server configuration.'}</p></div></section>
        <section className="check-method"><span className="eyebrow">WHAT PAUSE REVIEWS</span><div><span className="method-index">01</span><p>Message patterns and requests for money or account details.</p></div><div><span className="method-index">02</span><p>Redirects and domain registration details for links.</p></div><div><span className="method-index">03</span><p>Groq AI adds a second opinion when the server key is configured.</p></div></section>
        <p className="sidebar-privacy"><Icon name="lock" size={15} /> Shared result links leave out the original message.</p>
      </aside>
      </div>

    </main> : res ? <ResultScreen res={res} familyMode={familyMode} setFamilyMode={setFamilyMode} country={country} lang={lang} onBack={() => navigate('check')} onSpeak={speak} onCopy={copy} copied={copied} whatsappUrl={familyWhatsAppUrl()} /> : <main className="result-page"><button className="back-link" onClick={() => navigate('check')}>← Back to your check</button><p>No result to show yet. Run a check first.</p></main>}

    <footer className="site-footer"><button className="brand-button" onClick={() => navigate('start')}><Brand /></button><span>Pause is a helper, not a guarantee.</span><a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">India cybercrime support <Icon name="arrow" size={14} /></a></footer>
  </div>;
}
