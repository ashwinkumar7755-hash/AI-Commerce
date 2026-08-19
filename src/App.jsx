import { useState, useRef } from "react";
import { Search, Loader2, CheckCircle2, AlertTriangle, Shield, FileText, ChevronRight, Ban, HandCoins, Users } from "lucide-react";

// ---- Design tokens ----
const T = {
  bg: "#0A0E13",
  panel: "#12181F",
  panel2: "#0E1319",
  border: "#212B35",
  borderLight: "#2C3844",
  text: "#E7EDF3",
  muted: "#7E8FA0",
  mint: "#3ED8A0",
  amber: "#F0A93E",
  red: "#E1594B",
  mono: "'IBM Plex Mono', monospace",
  display: "'Space Grotesk', sans-serif",
  body: "'Inter', sans-serif",
};

const TEAM = ["Aswin Kumar H", "Jagan Raj M", "Muthulakshmi S"];

const VENDOR_POOL = [
  { name: "Amazon", tag: "AMZ" },
  { name: "Flipkart", tag: "FKT" },
  { name: "Croma", tag: "CRM" },
  { name: "Reliance Digital", tag: "REL" },
  { name: "Vijay Sales", tag: "VJS" },
  { name: "TataCliq", tag: "TCQ" },
  { name: "PayTM Mall", tag: "PTM" },
  { name: "Snapdeal", tag: "SNP" },
  { name: "JioMart", tag: "JIO" },
  { name: "Girias", tag: "GIR" },
];

// ---- Supported product categories ----
// `words` are the noun forms the parser looks for in the brief (used to detect
// both the category and, optionally, a brand/model phrase right before them).
const PRODUCT_CATEGORIES = [
  { emoji: "💻", label: "Laptops", words: ["laptop", "laptops", "notebook", "notebooks"],
    example: "Purchase 10 laptops, at least 16GB RAM and 512GB SSD, max ₹45,000 per unit, delivery within 7 days" },
  { emoji: "🖥️", label: "Monitors", words: ["monitor", "monitors", "display", "displays"],
    example: "Procure 8 external monitors, 24 inch, budget ₹12,000 per unit, within 4 days" },
  { emoji: "📱", label: "Phones", words: ["phone", "phones", "smartphone", "smartphones", "mobile", "mobiles"],
    example: "Buy 20 smartphones, at least 8GB RAM, under ₹18,000 per unit, delivered in 5 days" },
  { emoji: "🎧", label: "Headphones", words: ["headphone", "headphones", "headset", "headsets", "earphone", "earphones", "earbud", "earbuds"],
    example: "Purchase 30 wireless headphones, under ₹2,500 per unit, delivery within 6 days" },
  { emoji: "🪑", label: "Office Chairs", words: ["chair", "chairs"],
    example: "Buy 25 office chairs, ergonomic, under ₹8,000 each, delivered in 5 days" },
  { emoji: "🛋️", label: "Sofas", words: ["sofa", "sofas", "couch", "couches"],
    example: "Procure 6 office sofas, under ₹25,000 per unit, delivered in 10 days" },
  { emoji: "🖨️", label: "Printers", words: ["printer", "printers"],
    example: "Purchase 5 printers, under ₹15,000 per unit, delivery within 7 days" },
  { emoji: "⌨️", label: "Keyboards", words: ["keyboard", "keyboards"],
    example: "Buy 40 mechanical keyboards, under ₹2,000 per unit, delivered in 5 days" },
  { emoji: "🖱️", label: "Mouse", words: ["mouse", "mice"],
    example: "Purchase 40 wireless mouse units, under ₹800 per unit, delivered in 4 days" },
  { emoji: "📷", label: "Webcams", words: ["webcam", "webcams"],
    example: "Buy 15 webcams, 1080p, under ₹3,000 per unit, delivered in 5 days" },
  { emoji: "📡", label: "Routers", words: ["router", "routers"],
    example: "Buy 12 wifi routers, dual-band, under ₹3,500 per unit, delivered in 5 days" },
  { emoji: "📦", label: "Storage Devices", words: ["hard drive", "hard drives", "ssd drive", "ssd drives", "pen drive", "pen drives", "pendrive", "pendrives", "external drive", "external drives", "storage device", "storage devices"],
    example: "Purchase 20 1TB external hard drives, under ₹4,500 per unit, delivered in 6 days" },
];

const ITEM_WORD_PATTERN = PRODUCT_CATEGORIES.flatMap((c) => c.words).join("|");

// Keywords that indicate a genuine procurement/buying brief.
const PROCUREMENT_KEYWORDS = [
  "buy", "purchase", "procure", "order", "acquire", "sourcing", "source",
  "vendor", "supplier", "quote", "budget", "delivery", "deliver",
  "unit", "units", "item", "items", "piece", "pieces",
  "ram", "ssd", "₹", "rs.", "rupee", "inr",
  ...PRODUCT_CATEGORIES.flatMap((c) => c.words),
];

function isProcurementQuery(text) {
  const lower = text.toLowerCase();
  const hasKeyword = PROCUREMENT_KEYWORDS.some((k) => lower.includes(k));
  const hasQuantitySignal = /\d/.test(text);
  return hasKeyword && hasQuantitySignal;
}

// Captures an optional brand/model phrase immediately before the item noun,
// e.g. "Lenovo ThinkBook laptops" -> product = "Lenovo ThinkBook laptops", branded = true.
// Also identifies which product category the noun belongs to.
function parseProduct(text) {
  const brandedMatch = text.match(new RegExp(`((?:[A-Z][\\w-]*\\s*){1,4})(${ITEM_WORD_PATTERN})`, "i"));
  const genericMatch = text.match(new RegExp(`(${ITEM_WORD_PATTERN})`, "i"));
  const noun = (brandedMatch ? brandedMatch[2] : genericMatch ? genericMatch[1] : "laptops").toLowerCase();
  const category = PRODUCT_CATEGORIES.find((c) => c.words.includes(noun)) || PRODUCT_CATEGORIES[0];

  if (brandedMatch && brandedMatch[1].trim().length > 0) {
    return { product: `${brandedMatch[1].trim()} ${brandedMatch[2]}`.trim(), branded: true, category };
  }
  return { product: genericMatch ? genericMatch[1] : category.words[0], branded: false, category };
}

const QTY_WORD_PATTERN = [...PRODUCT_CATEGORIES.flatMap((c) => c.words), "unit", "units", "item", "items", "piece", "pieces"].join("|");

// Finds the per-unit budget, in priority order:
//  1. A number actually marked with ₹ (highest confidence — unambiguous currency).
//  2. A number next to a budget word ("under", "max", "budget", "up to", "per unit", "each").
//  3. Only as a last resort, any leftover 3+ digit number — but with the quantity, RAM,
//     SSD, and delivery matches stripped out first, so a quantity like "500 laptops" can
//     never be mistaken for a ₹500 budget just because no real price was ever stated.
// If nothing qualifies, falls back to a default and flags the brief as "assumed".
function parseBudget(text, exclude) {
  const currencyMatch = text.match(/₹\s?([\d,]{3,})/);
  if (currencyMatch) {
    const n = parseInt(currencyMatch[1].replace(/,/g, ""));
    if (n > 200 && n < 500000) return { value: n, found: true };
  }
  const keywordMatch = text.match(/(?:under|max(?:imum)?|budget(?:\s+of)?|up\s*to|per\s*unit|each)\D{0,12}?([\d,]{3,})/i);
  if (keywordMatch) {
    const n = parseInt(keywordMatch[1].replace(/,/g, ""));
    if (n > 200 && n < 500000) return { value: n, found: true };
  }
  let scrubbed = text;
  exclude.forEach((m) => { if (m) scrubbed = scrubbed.replace(m, ""); });
  const bareMatches = scrubbed.match(/([\d,]{3,})/g);
  if (bareMatches) {
    const nums = bareMatches.map((n) => parseInt(n.replace(/,/g, ""))).filter((n) => n > 200 && n < 500000);
    if (nums.length) return { value: Math.min(...nums), found: true };
  }
  return { value: 45000, found: false };
}

function parseBrief(text) {
  const qtyMatch = text.match(new RegExp(`(\\d+)\\s*(${QTY_WORD_PATTERN})`, "i"));
  const ramMatch = text.match(/(\d+)\s?GB\s?RAM/i);
  const ssdMatch = text.match(/(\d+)\s?GB\s?SSD/i);
  const deliveryMatch = text.match(/(\d+)\s?day/i);
  const { product, branded, category } = parseProduct(text);

  const qty = qtyMatch ? parseInt(qtyMatch[1]) : 10;
  const budgetResult = parseBudget(text, [qtyMatch?.[0], ramMatch?.[0], ssdMatch?.[0], deliveryMatch?.[0]]);
  const perUnitBudget = budgetResult.value;
  const ram = ramMatch ? parseInt(ramMatch[1]) : 16;
  const ssd = ssdMatch ? parseInt(ssdMatch[1]) : 512;
  const delivery = deliveryMatch ? parseInt(deliveryMatch[1]) : 7;
  const specsApply = category.label === "Laptops" || category.label === "Phones";

  return {
    qty, perUnitBudget, ram, ssd, delivery, product, branded, category, specsApply,
    assumed: !budgetResult.found || !deliveryMatch || (specsApply && (!ramMatch || !ssdMatch)),
  };
}

function generateQuotes(constraints) {
  const shuffled = [...VENDOR_POOL].sort(() => Math.random() - 0.5);
  return shuffled.map((v, i) => {
    const priceDelta = (Math.random() - 0.4) * 0.22; // some over, mostly near/under
    const price = Math.round((constraints.perUnitBudget * (1 + priceDelta)) / 100) * 100;
    const ram = Math.random() > 0.15 ? constraints.ram : constraints.ram - 8;
    const ssd = Math.random() > 0.15 ? constraints.ssd : constraints.ssd - 256;
    const delivery = Math.max(1, constraints.delivery + Math.round((Math.random() - 0.5) * 6));
    const rating = (3.6 + Math.random() * 1.3).toFixed(1);
    const returnDays = [7, 10, 15, 30][Math.floor(Math.random() * 4)];
    const reliability = Math.round(70 + Math.random() * 28);
    const unavailable = i === shuffled.length - 1 && Math.random() > 0.4;
    const specsOk = constraints.specsApply ? (ram >= constraints.ram && ssd >= constraints.ssd) : true;
    const meetsAll = specsOk && price <= constraints.perUnitBudget && delivery <= constraints.delivery && !unavailable;
    return { ...v, price, ram, ssd, delivery, rating: parseFloat(rating), returnDays, reliability, unavailable, meetsAll };
  });
}

function scoreVendor(v) {
  // weighted: price(35) rating(25) delivery(20) reliability(20)
  const priceScore = Math.max(0, 100 - (v.price / 1000));
  const ratingScore = (v.rating / 5) * 100;
  const deliveryScore = Math.max(0, 100 - v.delivery * 8);
  return Math.round(priceScore * 0.35 + ratingScore * 0.25 + deliveryScore * 0.2 + v.reliability * 0.2);
}

// Negotiated price is a flat 5% discount off the vendor's quoted price, rounded to the nearest ₹100.
function negotiate(price) {
  return Math.round((price * 0.95) / 100) * 100;
}

// Builds a simulated back-and-forth negotiation thread with the winning vendor.
// The final agreed price always matches negotiate(vendor.price) so the chat log
// and the summary numbers/audit log stay consistent.
function buildNegotiationThread(vendor, qty, negotiatedPrice) {
  const openingAsk = Math.round((vendor.price * 0.9) / 100) * 100;
  const vendorCounter = Math.round((vendor.price * 0.97) / 100) * 100;
  return [
    { from: "agent", text: `Requesting bulk pricing for ${qty} units — can you do ₹${openingAsk.toLocaleString("en-IN")} per unit?` },
    { from: "vendor", text: `We can offer ₹${vendorCounter.toLocaleString("en-IN")} per unit given current stock and demand.` },
    { from: "agent", text: `We can commit to the full ${qty}-unit order today at ₹${negotiatedPrice.toLocaleString("en-IN")} per unit — can we close there?` },
    { from: "vendor", text: `Agreed — ₹${negotiatedPrice.toLocaleString("en-IN")} per unit confirmed for ${qty} units.` },
  ];
}

export default function ProcurementAgent() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | tracing | done | rejected
  const [trace, setTrace] = useState([]);
  const [constraints, setConstraints] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [approved, setApproved] = useState(false);
  const timers = useRef([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function runAgent(q) {
    clearTimers();
    setApproved(false);

    if (!isProcurementQuery(q)) {
      setPhase("rejected");
      setTrace([]);
      return;
    }

    setPhase("tracing");
    setTrace([]);
    const c = parseBrief(q);
    const qs = generateQuotes(c);
    setConstraints(c);
    setQuotes(qs);

    // Mirror the render-time eligibility/ranking logic so the trace narrates the same outcome.
    const eligibleOnRun = qs.filter((v) => v.meetsAll);
    const rankedOnRun = [...eligibleOnRun].sort((a, b) => scoreVendor(b) - scoreVendor(a));
    const winnerOnRun = rankedOnRun[0];

    const specsLine = c.specsApply
      ? (c.assumed
          ? `! some constraints unstated — assuming qty=${c.qty}, RAM≥${c.ram}GB, SSD≥${c.ssd}GB, delivery≤${c.delivery}d, budget≤₹${c.perUnitBudget.toLocaleString("en-IN")}/unit`
          : `✓ constraints extracted — qty=${c.qty}, RAM≥${c.ram}GB, SSD≥${c.ssd}GB, delivery≤${c.delivery}d, budget≤₹${c.perUnitBudget.toLocaleString("en-IN")}/unit`)
      : (c.assumed
          ? `! some constraints unstated — assuming qty=${c.qty}, delivery≤${c.delivery}d, budget≤₹${c.perUnitBudget.toLocaleString("en-IN")}/unit`
          : `✓ constraints extracted — qty=${c.qty}, delivery≤${c.delivery}d, budget≤₹${c.perUnitBudget.toLocaleString("en-IN")}/unit`);

    const lines = [
      { t: `> parsing buying brief`, d: 0 },
      { t: c.branded
          ? `✓ sourcing: ${c.category.emoji} ${c.product} — specific brand/model detected`
          : `! no specific brand/model given — sourcing generic ${c.category.emoji} ${c.product} (category: ${c.category.label})`,
        d: 350, warn: !c.branded },
      { t: specsLine, d: 650, warn: c.assumed },
      ...qs.map((v, i) => ({
        t: v.unavailable
          ? `✗ ${v.name} — top match went out of stock mid-query, skipping`
          : `✓ ${v.name} — found ${c.product}: ₹${v.price.toLocaleString("en-IN")}${c.specsApply ? `, ${v.ram}GB/${v.ssd}GB` : ""}, ${v.delivery}d delivery, ${v.rating}★`,
        d: 850 + i * 380,
        warn: v.unavailable,
      })),
      { t: `> comparing ${qs.filter((v) => !v.unavailable).length} live quotes on price, specs, delivery, rating, reliability`, d: 850 + qs.length * 380 + 300 },
      { t: `> ranking candidates against stated constraints`, d: 850 + qs.length * 380 + 700 },
    ];

    let tailDelay = 850 + qs.length * 380 + 700;

    if (winnerOnRun) {
      const negotiatedPrice = negotiate(winnerOnRun.price);
      lines.push(
        { t: `> initiating negotiation with ${winnerOnRun.name} (top-ranked vendor)`, d: tailDelay + 450 },
        { t: `✓ ${winnerOnRun.name} agreed to a 5% volume discount — ₹${winnerOnRun.price.toLocaleString("en-IN")} → ₹${negotiatedPrice.toLocaleString("en-IN")} per unit`, d: tailDelay + 950 },
      );
      tailDelay += 950;
    } else {
      lines.push({ t: `> no eligible vendor to negotiate with — skipping negotiation`, d: tailDelay + 450, warn: true });
      tailDelay += 450;
    }

    lines.forEach((line) => {
      const id = setTimeout(() => {
        setTrace((prev) => [...prev, line]);
      }, line.d);
      timers.current.push(id);
    });

    const finalId = setTimeout(() => setPhase("done"), tailDelay + 400);
    timers.current.push(finalId);
  }

  const eligible = quotes.filter((v) => v.meetsAll);
  const ranked = [...eligible].sort((a, b) => scoreVendor(b) - scoreVendor(a));
  const winner = ranked[0];
  const negotiatedPrice = winner ? negotiate(winner.price) : 0;
  const negotiationThread = winner ? buildNegotiationThread(winner, constraints.qty, negotiatedPrice) : [];
  const originalTotal = winner ? winner.price * (constraints?.qty || 1) : 0;
  const negotiatedTotal = winner ? negotiatedPrice * (constraints?.qty || 1) : 0;
  const savings = originalTotal - negotiatedTotal;
  const authLimit = 500000;
  const needsApproval = winner && negotiatedTotal > authLimit;
  const noneQualify = phase === "done" && eligible.length === 0;

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: T.body }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: ${T.mint}33; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .trace-line { animation: fadeUp 0.25s ease-out; }
        @keyframes hsSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .hs-spin { animation: hsSpin 0.8s linear infinite; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Shield size={18} color={T.mint} />
          <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 15, letterSpacing: 0.3 }}>HOUSE STARK</span>
        </div>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>autonomous commerce — round 1 concept</span>
      </div>

      {/* Hero / Search */}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "56px 24px 24px" }}>
        <h1 style={{ fontFamily: T.display, fontSize: 34, fontWeight: 700, lineHeight: 1.15, marginBottom: 10 }}>
          AI Autonomous Commerce System
        </h1>
        <p style={{ color: T.muted, fontSize: 14.5, marginBottom: 18, maxWidth: 560 }}>
          Search once. The agent checks vendors, compares on price, specs, delivery and reliability,
          negotiates a discount on your behalf, and stops for your approval before anything is confirmed.
        </p>

        {/* Team credit */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: T.muted, fontFamily: T.mono, fontSize: 11 }}>
            <Users size={13} />
            Team House Stark:
          </div>
          {TEAM.map((name) => (
            <span
              key={name}
              style={{ fontFamily: T.mono, fontSize: 11, color: T.text, background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "3px 8px" }}
            >
              {name}
            </span>
          ))}
        </div>

        {/* What to include */}
        <div style={{ border: `1px solid ${T.border}`, background: T.panel2, borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, letterSpacing: 0.5, marginBottom: 8 }}>
            INCLUDE THESE IN YOUR BRIEF FOR BEST RESULTS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            {[
              { label: "Product / category", eg: "e.g. Lenovo ThinkBook laptops" },
              { label: "Quantity", eg: "e.g. 10 units" },
              { label: "Budget / unit", eg: "e.g. ₹45,000" },
              { label: "Delivery window", eg: "e.g. within 7 days" },
            ].map((f) => (
              <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: T.text }}>{f.label}</span>
                <span style={{ fontSize: 11, fontFamily: T.mono, color: T.muted }}>{f.eg}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>
            A brand/model (e.g. "Lenovo ThinkBook") is optional — leave it out and the agent sources a generic match
            in that category. Any other field left out gets a sensible default, flagged in amber in the trace below.
          </div>
        </div>

        {/* Product categories */}
        <div style={{ border: `1px solid ${T.border}`, background: T.panel2, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, letterSpacing: 0.5, marginBottom: 8 }}>
            📦 PRODUCT CATEGORIES — TAP TO TRY ONE
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PRODUCT_CATEGORIES.map((c) => (
              <button
                key={c.label}
                onClick={() => { setQuery(c.example); runAgent(c.example); }}
                style={{
                  fontSize: 12, color: T.text, background: T.panel, border: `1px solid ${T.border}`,
                  borderRadius: 7, padding: "6px 10px", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  flex: "0 0 auto", whiteSpace: "nowrap",
                }}
              >
                <span>{c.emoji}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", background: T.panel, border: `1px solid ${T.borderLight}`, borderRadius: 10, padding: "0 14px" }}>
            <Search size={16} color={T.muted} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && query.trim() && runAgent(query)}
              placeholder="e.g. Purchase 10 Lenovo ThinkBook laptops, 16GB RAM, max ₹45,000/unit, within 7 days"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: T.text, padding: "13px 10px", fontSize: 13.5, fontFamily: T.body }}
            />
          </div>
          <button
            onClick={() => query.trim() && runAgent(query)}
            disabled={!query.trim() || phase === "tracing"}
            style={{
              background: T.mint, color: "#062018", border: "none", borderRadius: 10, padding: "0 20px",
              fontFamily: T.display, fontWeight: 600, fontSize: 13.5, cursor: query.trim() ? "pointer" : "default",
              opacity: !query.trim() || phase === "tracing" ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {phase === "tracing" ? <Loader2 size={15} className="hs-spin" /> : <ChevronRight size={15} />}
            Run agent
          </button>
        </div>
      </div>

      {phase === "idle" && (
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "12px 24px 80px", color: T.muted, fontSize: 12.5 }}>
          No live vendor calls happen until you run the agent. All quotes below are simulated for this Round 1 concept.
        </div>
      )}

      {phase === "rejected" && (
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px 90px" }}>
          <div style={{ background: `${T.red}14`, border: `1px solid ${T.red}55`, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <Ban size={16} color={T.red} />
              <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 13.5 }}>This isn't a procurement request</span>
            </div>
            <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 10 }}>
              House Stark only handles buying briefs — a quantity of items, a budget, or delivery terms to source
              against, from one of its supported categories. It won't answer general questions, chat, or anything
              unrelated to procurement.
            </p>
            <p style={{ fontSize: 12, fontFamily: T.mono, color: T.text }}>
              Try something like: "Buy 15 office chairs, under ₹9,000 each, delivered in 6 days"
            </p>
          </div>
        </div>
      )}

      {(phase === "tracing" || phase === "done") && (
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px 90px" }}>

          {/* Agent trace terminal */}
          <div style={{ background: "#080B0F", border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px 18px", marginBottom: 22, fontFamily: T.mono, fontSize: 12.5, minHeight: 60 }}>
            <div style={{ color: T.muted, fontSize: 10.5, marginBottom: 10, letterSpacing: 0.5 }}>AGENT TRACE</div>
            {trace.map((line, i) => (
              <div key={i} className="trace-line" style={{ color: line.warn ? T.amber : T.mint, marginBottom: 6, opacity: 0.95 }}>
                {line.t}
              </div>
            ))}
            {phase === "tracing" && <div style={{ color: T.muted }}>▍</div>}
          </div>

          {phase === "done" && (
            <>
              {/* Sourcing summary */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 12.5, color: T.muted }}>
                <span style={{ fontSize: 16 }}>{constraints.category.emoji}</span>
                Sourcing <span style={{ color: T.text, fontWeight: 600 }}>{constraints.product}</span>
                <span style={{ fontFamily: T.mono, fontSize: 10.5, background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 5, padding: "2px 6px" }}>
                  {constraints.category.label}
                </span>
              </div>

              {/* Comparison table */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Vendor comparison</div>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: T.panel2, color: T.muted, textAlign: "left" }}>
                        {["Vendor", "Price/unit", ...(constraints.specsApply ? ["Specs"] : []), "Delivery", "Rating", "Returns", "Status"].map((h) => (
                          <th key={h} style={{ padding: "9px 12px", fontWeight: 500, fontFamily: T.mono, fontSize: 10.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((v) => (
                        <tr key={v.name} style={{ borderTop: `1px solid ${T.border}`, background: winner?.name === v.name ? `${T.mint}0F` : "transparent" }}>
                          <td style={{ padding: "9px 12px" }}>{v.name}</td>
                          {v.unavailable ? (
                            <td colSpan={constraints.specsApply ? 5 : 4} style={{ padding: "9px 12px", color: T.muted }}>— went unavailable during the query —</td>
                          ) : (
                            <>
                              <td style={{ padding: "9px 12px" }}>₹{v.price.toLocaleString("en-IN")}</td>
                              {constraints.specsApply && (
                                <td style={{ padding: "9px 12px", color: (v.ram < constraints.ram || v.ssd < constraints.ssd) ? T.red : T.text }}>{v.ram}GB / {v.ssd}GB</td>
                              )}
                              <td style={{ padding: "9px 12px", color: v.delivery > constraints.delivery ? T.red : T.text }}>{v.delivery}d</td>
                              <td style={{ padding: "9px 12px" }}>{v.rating}★</td>
                              <td style={{ padding: "9px 12px" }}>{v.returnDays}d</td>
                            </>
                          )}
                          <td style={{ padding: "9px 12px" }}>
                            {v.unavailable ? (
                              <span style={{ color: T.muted, display: "flex", alignItems: "center", gap: 4 }}><Ban size={12} /> skipped</span>
                            ) : v.meetsAll ? (
                              <span style={{ color: T.mint, display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={12} /> eligible</span>
                            ) : (
                              <span style={{ color: T.amber }}>fails constraint</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recommendation / edge case */}
              {noneQualify ? (
                <div style={{ background: `${T.red}14`, border: `1px solid ${T.red}55`, borderRadius: 10, padding: "16px 18px", marginBottom: 22 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <AlertTriangle size={16} color={T.red} />
                    <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 13.5 }}>No vendor meets every constraint</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 8 }}>
                    Every option fails on at least one requirement — usually price or delivery window. The agent will not
                    silently relax your constraints. It surfaces the closest alternatives and asks you to decide.
                  </p>
                  <p style={{ fontSize: 12, fontFamily: T.mono, color: T.text }}>
                    Suggested relaxation: raise budget to ₹{Math.round(constraints.perUnitBudget * 1.08).toLocaleString("en-IN")}/unit,
                    or extend delivery to {constraints.delivery + 2} days.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ background: T.panel, border: `1px solid ${T.borderLight}`, borderRadius: 10, padding: "16px 18px", marginBottom: 22 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                      <CheckCircle2 size={16} color={T.mint} />
                      <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 13.5 }}>Recommendation: {winner.name}</span>
                      <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginLeft: "auto" }}>score {scoreVendor(winner)}/100</span>
                    </div>
                    <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 10 }}>
                      Chosen over {eligible.length - 1} other eligible vendor{eligible.length - 1 === 1 ? "" : "s"} — best balance of price
                      (₹{winner.price.toLocaleString("en-IN")}/unit), delivery ({winner.delivery}d), rating ({winner.rating}★),
                      and seller reliability ({winner.reliability}/100). All stated constraints are met.
                    </p>
                  </div>

                  {/* Negotiation Summary */}
                  <div style={{ background: `${T.mint}0D`, border: `1px solid ${T.mint}44`, borderRadius: 10, padding: "16px 18px", marginBottom: 22 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                      <HandCoins size={16} color={T.mint} />
                      <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 13.5 }}>Negotiation summary</span>
                    </div>
                    <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 12 }}>
                      The agent negotiated directly with {winner.name} and secured a 5% volume discount before
                      finalizing the order.
                    </p>

                    {/* Negotiation thread */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                      {negotiationThread.map((m, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: m.from === "agent" ? "flex-end" : "flex-start",
                          }}
                        >
                          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 3, padding: "0 2px" }}>
                            {m.from === "agent" ? "HOUSE STARK AGENT" : winner.name.toUpperCase()}
                          </span>
                          <div
                            style={{
                              maxWidth: "78%",
                              fontSize: 12.5,
                              lineHeight: 1.45,
                              padding: "8px 12px",
                              borderRadius: 10,
                              background: m.from === "agent" ? `${T.mint}1A` : T.panel2,
                              border: `1px solid ${m.from === "agent" ? T.mint + "44" : T.border}`,
                              color: T.text,
                            }}
                          >
                            {m.text}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <div style={{ background: T.panel2, borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 4 }}>ORIGINAL PRICE/UNIT</div>
                        <div style={{ fontFamily: T.mono, fontSize: 13.5, color: T.text, textDecoration: "line-through", opacity: 0.7 }}>₹{winner.price.toLocaleString("en-IN")}</div>
                      </div>
                      <div style={{ background: T.panel2, borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 4 }}>NEGOTIATED PRICE/UNIT</div>
                        <div style={{ fontFamily: T.mono, fontSize: 13.5, color: T.mint }}>₹{negotiatedPrice.toLocaleString("en-IN")}</div>
                      </div>
                      <div style={{ background: T.panel2, borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 4 }}>TOTAL SAVINGS</div>
                        <div style={{ fontFamily: T.mono, fontSize: 13.5, color: T.mint }}>₹{savings.toLocaleString("en-IN")}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, fontFamily: T.mono, background: T.panel2, borderRadius: 8, padding: "10px 12px", marginTop: 10 }}>
                      total order (post-negotiation): {constraints.qty} × ₹{negotiatedPrice.toLocaleString("en-IN")} = ₹{negotiatedTotal.toLocaleString("en-IN")}
                      <span style={{ color: T.muted }}> · authorization limit ₹{authLimit.toLocaleString("en-IN")}</span>
                    </div>

                    {needsApproval && !approved && (
                      <div style={{ marginTop: 12, background: `${T.amber}14`, border: `1px solid ${T.amber}55`, borderRadius: 8, padding: "12px 14px" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                          <AlertTriangle size={14} color={T.amber} />
                          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Exceeds authorization limit — paused for approval</span>
                        </div>
                        <p style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>
                          Even after the negotiated discount, this order is ₹{(negotiatedTotal - authLimit).toLocaleString("en-IN")} over
                          the ₹{authLimit.toLocaleString("en-IN")} limit this agent can confirm on its own. It will not proceed without your sign-off.
                        </p>
                        <button
                          onClick={() => setApproved(true)}
                          style={{ background: T.amber, color: "#241800", border: "none", borderRadius: 6, padding: "7px 14px", fontFamily: T.display, fontWeight: 600, fontSize: 12, cursor: "pointer" }}
                        >
                          Approve exception
                        </button>
                      </div>
                    )}

                    {(!needsApproval || approved) && (
                      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.mint }}>
                        <CheckCircle2 size={14} />
                        Mock purchase confirmed at negotiated price — order written to log. No real payment or vendor transaction occurred.
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Audit log */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <FileText size={14} color={T.muted} />
                  <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 14 }}>Audit log entry</span>
                </div>
                <pre style={{ background: "#080B0F", border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", fontFamily: T.mono, fontSize: 11.5, color: T.muted, overflowX: "auto", lineHeight: 1.6 }}>
{`{
  "brief": "${query}",
  "product": "${constraints.product}",
  "category": "${constraints.category.label}",
  "brand_model_detected": ${constraints.branded},
  "constraints_extracted": ${JSON.stringify({ qty: constraints.qty, ram_gb: constraints.specsApply ? constraints.ram : null, ssd_gb: constraints.specsApply ? constraints.ssd : null, budget_per_unit: constraints.perUnitBudget, delivery_days: constraints.delivery }, null, 2).split("\n").join("\n  ")},
  "vendors_checked": ${quotes.length},
  "vendors_eligible": ${eligible.length},
  "decision": "${noneQualify ? "no_qualifying_vendor" : needsApproval && !approved ? "paused_for_approval" : "confirmed"}",
  "selected_vendor": ${winner ? `"${winner.name}"` : "null"},
  "negotiation": ${winner ? JSON.stringify({
      attempted: true,
      discount_pct: 5,
      original_price_per_unit_inr: winner.price,
      negotiated_price_per_unit_inr: negotiatedPrice,
      savings_inr: savings,
      thread: negotiationThread.map((m) => ({ from: m.from, message: m.text })),
    }, null, 2).split("\n").join("\n  ") : "null"},
  "total_value_inr": ${negotiatedTotal},
  "authorization_limit_inr": ${authLimit},
  "human_approval_required": ${needsApproval},
  "human_approval_given": ${approved},
  "team": ${JSON.stringify(TEAM)}
}`}
                </pre>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}