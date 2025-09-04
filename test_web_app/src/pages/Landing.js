import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Shield,
  Zap,
  Workflow,
  CreditCard,
  ArrowRight,
  Server,
  Boxes,
  Webhook,
  Lock,
  BookOpen,
  Code2,
  GitBranch,
} from 'lucide-react';

const Feature = ({ icon: Icon, title, children }) => (
  <div className="p-6 rounded-xl border border-primary-200 dark:border-primary-700 bg-white dark:bg-primary-800">
    <div className="flex items-center mb-3">
      <div className="w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-900 flex items-center justify-center mr-3">
        <Icon className="h-5 w-5 text-accent-600 dark:text-accent-300" />
      </div>
      <h3 className="text-lg font-semibold text-primary">{title}</h3>
    </div>
    <p className="text-secondary text-sm">{children}</p>
  </div>
);

const Plan = ({ name, price, cta = 'Get started', popular = false, features = [] }) => (
  <div className={`relative rounded-2xl border ${popular ? 'border-accent-500 ring-2 ring-accent-300/40' : 'border-primary-200 dark:border-primary-700'} bg-white dark:bg-primary-800 p-6`}> 
    {popular && (
      <div className="absolute -top-3 right-4 px-2 py-0.5 text-xs rounded bg-accent-600 text-white">Most popular</div>
    )}
    <h4 className="text-xl font-semibold text-primary mb-1">{name}</h4>
    <div className="text-3xl font-bold text-primary mb-4">{price}<span className="text-base font-normal text-secondary">/mo</span></div>
    <ul className="space-y-2 mb-5 text-sm">
      {features.map((f, i) => (
        <li key={i} className="flex items-start">
          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
          <span className="text-secondary">{f}</span>
        </li>
      ))}
    </ul>
    <Link to="/dashboard" className="btn btn-primary w-full flex items-center justify-center">
      <CreditCard className="h-4 w-4 mr-2" /> {cta}
    </Link>
  </div>
);

const Landing = () => {
  const taglines = [
    'Customize any document type to your exact schema and workflow',
  'Works with handwritten and digital documents',
  'Schema-first extraction with human review',
  ];
  const [taglineIndex, setTaglineIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTaglineIndex((i) => (i + 1) % taglines.length), 3000);
    return () => clearInterval(id);
  }, [taglines.length]);
  return (
    <div className="min-h-screen bg-primary">
      {/* Hero */}
      <section className="container mx-auto px-4 pt-10 pb-12">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-900 dark:to-accent-900 border border-primary-200 dark:border-primary-700 p-8 md:p-12">
          {/* Decorative animated blobs */}
          <div className="pointer-events-none absolute -top-16 -left-16 w-72 h-72 bg-accent-400/30 dark:bg-accent-500/20 blur-3xl rounded-full animate-float"></div>
          <div className="pointer-events-none absolute -bottom-20 -right-10 w-96 h-96 bg-primary-400/20 dark:bg-primary-300/10 blur-3xl rounded-full animate-float-slow"></div>
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div className="max-w-2xl">
              <div className="flex items-center mb-3">
                <span className="text-sm text-secondary">Introducing</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 gradient-text">Parser</h1>
              <p className="text-lg text-secondary transition-opacity duration-500" key={taglineIndex}>
                {taglines[taglineIndex]}
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                <Link to="/dashboard" className="btn btn-primary">
                  Continue to testing <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
                <Link to="/doc-types" className="btn btn-accent">Create a doc type</Link>
                <Link to="/upload" className="btn btn-secondary">Process a document</Link>
              </div>
              {/* Format badges */}
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="badge">PDF</span>
                <span className="badge">JPG / PNG</span>
                <span className="badge">TIFF</span>
                <span className="badge-muted">Handwritten & digital</span>
              </div>
            </div>
            {/* Right side tiles removed per request */}
          </div>
        </div>
      </section>

      {/* Customize any document type */}
      <section className="container mx-auto px-4 pb-16">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-primary">Customize any document type</h2>
          <Link to="/doc-types" className="btn btn-accent">Open doc type builder</Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Left: bullets */}
          <div className="p-6 rounded-xl glass">
            <h3 className="text-lg font-semibold text-primary mb-3">Your schema, your rules</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm text-secondary">
              <li>Define typed JSON schemas with nested objects and arrays</li>
              <li>AI generator drafts fields from sample docs; refine in the visual builder</li>
              <li>Field-level validation: required, enum, min/max, formats (email, date, number)</li>
              <li>Per-type extraction instructions and prompts for consistent results</li>
              <li>Works with scanned, handwritten, and digital documents (PDFs, images, photos)</li>
              <li>Per-type pipelines: choose steps like review, reconcile with reference data, and webhook delivery</li>
            </ul>
          </div>
          {/* Right: impact blurbs (concise, non-numeric) */}
          <div className="p-6 rounded-xl glass">
            <h3 className="text-lg font-semibold text-primary mb-4">Immediate impact</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl p-4 bg-white/50 dark:bg-white/10 border border-white/30 dark:border-white/10">
                <div className="text-2xl font-extrabold gradient-text">Faster turnaround</div>
                <div className="text-xs text-secondary">From upload to structured JSON</div>
              </div>
              <div className="rounded-xl p-4 bg-white/50 dark:bg-white/10 border border-white/30 dark:border-white/10">
                <div className="text-2xl font-extrabold gradient-text">Fewer keystrokes</div>
                <div className="text-xs text-secondary">Automate the tedious parts</div>
              </div>
              <div className="rounded-xl p-4 bg-white/50 dark:bg-white/10 border border-white/30 dark:border-white/10">
                <div className="text-2xl font-extrabold gradient-text">Reads handwriting</div>
                <div className="text-xs text-secondary">Scans, photos, and PDFs</div>
              </div>
              <div className="rounded-xl p-4 bg-white/50 dark:bg-white/10 border border-white/30 dark:border-white/10">
                <div className="text-2xl font-extrabold gradient-text">Reliable at scale</div>
                <div className="text-xs text-secondary">Stable under real workloads</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Parser */}
      <section className="container mx-auto px-4 pb-12">
        <h2 className="text-2xl font-bold text-primary mb-4">Why Parser?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl glass">
            <div className="flex items-center mb-2"><Workflow className="h-5 w-5 mr-2" /><h3 className="font-semibold text-primary">Accurate by design</h3></div>
            <p className="text-sm text-secondary">Your schema is the source of truth—types and required fields enforced.</p>
          </div>
          <div className="p-6 rounded-2xl glass">
            <div className="flex items-center mb-2"><Shield className="h-5 w-5 mr-2" /><h3 className="font-semibold text-primary">Review when needed</h3></div>
            <p className="text-sm text-secondary">Route low‑confidence fields for human approval with full audit.</p>
          </div>
          <div className="p-6 rounded-2xl glass">
            <div className="flex items-center mb-2"><Zap className="h-5 w-5 mr-2" /><h3 className="font-semibold text-primary">From upload to delivery</h3></div>
            <p className="text-sm text-secondary">Automate processing and send verified data to your systems.</p>
          </div>
        </div>
      </section>

      {/* Where it helps */}
      <section className="container mx-auto px-4 pb-12">
        <h2 className="text-2xl font-bold text-primary mb-4">Where it helps</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Feature icon={Boxes} title="Finance & AP">Automate invoice capture, PO matching, and remittance advice with validation gates and approval workflows.</Feature>
          <Feature icon={BookOpen} title="Operations & Compliance">Parse contracts, onboarding docs, and KYC packs with required-field enforcement and full audit trails.</Feature>
          <Feature icon={Webhook} title="RevOps & Support">Ingest order forms, statements of work, and support attachments and push clean data into your CRM, ERP, or ticketing systems.</Feature>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-primary mb-6">How it works</h2>
        <ol className="relative border-s border-primary-200 dark:border-primary-700 ml-2">
          <li className="mb-10 ms-6">
            <span className="absolute -start-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent-600 text-white text-xs">1</span>
            <h3 className="font-semibold text-primary">Define your type</h3>
            <p className="text-sm text-secondary">Create a custom type with AI‑generated fields, then refine in the visual builder.</p>
          </li>
          <li className="mb-10 ms-6">
            <span className="absolute -start-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent-600 text-white text-xs">2</span>
            <h3 className="font-semibold text-primary">Process documents</h3>
            <p className="text-sm text-secondary">Upload scans, photos, or PDFs. Parser extracts, validates, and tracks provenance.</p>
          </li>
          <li className="ms-6">
            <span className="absolute -start-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent-600 text-white text-xs">3</span>
            <h3 className="font-semibold text-primary">Review & ship</h3>
            <p className="text-sm text-secondary">If needed, send for review and reconcile with reference data—then deliver to your webhook.</p>
          </li>
        </ol>
      </section>

      {/* Technical deep-dive */}
      <section className="container mx-auto px-4 pb-12">
        <h2 className="text-2xl font-bold text-primary mb-4">Technical deep‑dive</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-primary-200 dark:border-primary-700 bg-white dark:bg-primary-800">
            <h3 className="text-lg font-semibold text-primary mb-3">Pipeline & state machine</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm text-secondary">
              <li>Composable steps: ingest → extract → validate → review → reconcile with reference data → finalize → webhook</li>
              <li>Schema-first validation using your JSON schema (types, required, nested objects, arrays)</li>
              <li>Human review gates with field-level approvals and audit logs</li>
              <li>Reconciliation against reference data to fill gaps and verify values</li>
              <li>Deterministic finalize step that emits a single authoritative record</li>
            </ul>
          </div>
          <div className="p-6 rounded-xl border border-primary-200 dark:border-primary-700 bg-white dark:bg-primary-800">
            <h3 className="text-lg font-semibold text-primary mb-3">Architecture</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm text-secondary">
              <li><Server className="inline h-4 w-4 mr-1" /> FastAPI backend with modular routers (ingest, doc types, HIL, reconcile, reports, finalize)</li>
              <li><GitBranch className="inline h-4 w-4 mr-1" /> Worker-based orchestration for extraction and long‑running jobs</li>
              <li><Webhook className="inline h-4 w-4 mr-1" /> Webhook dispatch service to deliver finalized payloads</li>
              <li><Shield className="inline h-4 w-4 mr-1" /> Tenant‑aware APIs, authentication, rate limiting, and audit logging</li>
              <li><Code2 className="inline h-4 w-4 mr-1" /> React front‑end with schema builder, review queues, and reference tools</li>
            </ul>
          </div>
        </div>
      </section>

      

      {/* Security & compliance */}
      <section className="container mx-auto px-4 pb-12">
        <h2 className="text-2xl font-bold text-primary mb-4">Security & compliance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Feature icon={Lock} title="Tenant isolation">Requests are scoped with tenant context and auditable actions for traceability.</Feature>
          <Feature icon={Shield} title="Access control">Auth endpoints and rate‑limits protect data and workflows; adhere to least privilege.</Feature>
          <Feature icon={Server} title="Data handling">Schema validation reduces downstream risk; webhooks send only finalized, typed payloads.</Feature>
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-primary mb-4">Simple, fair pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Plan name="Free" price="$0" cta="Start free" features={[
            '500 pages/mo',
            '1 custom doc type',
            'Human review basics',
            'Webhook delivery',
          ]} />
          <Plan name="Starter" price="$15" popular features={[
            '5,000 pages/mo',
            '5 custom doc types',
            'Reference data',
            'Email support',
          ]} />
          <Plan name="Pro" price="$60" features={[
            '25,000 pages/mo',
            'Unlimited types',
            'Priority review queues',
            'SLA 99.9%',
          ]} />
          <Plan name="Business" price="$180" cta="Contact sales" features={[
            '100,000 pages/mo',
            'SAML/SSO',
            'Custom webhooks',
            'Premium support',
          ]} />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary-200 dark:border-primary-700 py-8">
        <div className="container mx-auto px-4 text-sm text-secondary">
          <div className="flex flex-col md:flex-row justify-between gap-2">
            <div>© {new Date().getFullYear()} Parser</div>
            <div className="space-x-4">
              <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
              <Link to="/doc-types" className="hover:text-primary">Doc Types</Link>
              <Link to="/rag" className="hover:text-primary">RAG</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Final CTA */}
      <section className="container mx-auto px-4 pb-16">
        <div className="rounded-2xl p-8 md:p-10 bg-gradient-to-r from-accent-600 to-primary-600 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold mb-1">Turn messy documents into clean data</h3>
            <p className="text-white/90 text-sm">Customize any type, process handwritten or digital, and deliver structured JSON to your systems.</p>
          </div>
          <div className="flex gap-3">
            <Link to="/dashboard" className="btn btn-secondary bg-white text-primary-900 hover:bg-white/90">Continue to testing</Link>
            <Link to="/doc-types" className="btn btn-accent">Create a doc type</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
