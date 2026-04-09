import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Cpu, Users, Check, X, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const terminalMessages = [
  "SQL Injection detected in /login",
  "XSS vulnerability found in search param",
  "IDOR vulnerability: User A can access User B data",
  "JWT algorithm confusion attack detected",
];

function TerminalAnimation() {
  const [msgIndex, setMsgIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const msg = terminalMessages[msgIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && charIndex < msg.length) {
      timeout = setTimeout(() => setCharIndex((c) => c + 1), 40);
    } else if (!isDeleting && charIndex === msg.length) {
      timeout = setTimeout(() => setIsDeleting(true), 2000);
    } else if (isDeleting && charIndex > 0) {
      timeout = setTimeout(() => setCharIndex((c) => c - 1), 20);
    } else if (isDeleting && charIndex === 0) {
      setIsDeleting(false);
      setMsgIndex((i) => (i + 1) % terminalMessages.length);
    }

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, msgIndex]);

  const currentText = terminalMessages[msgIndex].slice(0, charIndex);

  return (
    <div className="bg-[#0d0d14] border border-border rounded-xl p-5 font-mono text-sm max-w-xl mx-auto lg:mx-0 shadow-2xl">
      <div className="flex items-center gap-2 mb-4">
        <span className="h-3 w-3 rounded-full bg-severity-critical/60" />
        <span className="h-3 w-3 rounded-full bg-severity-medium/60" />
        <span className="h-3 w-3 rounded-full bg-severity-low/60" />
        <span className="text-[10px] text-muted-foreground ml-2 uppercase tracking-wider">origin-scanner</span>
      </div>
      <div className="text-muted-foreground min-h-[24px]">
        <span className="text-severity-low">$</span>{" "}
        <span className="text-severity-high font-medium">[ALERT]</span>{" "}
        <span className="text-foreground">{currentText}</span>
        <span className="inline-block w-2 h-5 bg-primary ml-0.5 animate-blink align-middle" />
      </div>
    </div>
  );
}

const features = [
  {
    icon: Shield,
    title: "AI-Powered Analysis",
    desc: "Claude AI enriches every finding with plain-English explanations, business impact assessment, and step-by-step remediation guidance.",
  },
  {
    icon: Cpu,
    title: "SPA & API Native",
    desc: "Renders JavaScript, discovers GraphQL endpoints, handles JWT and OAuth auth flows that legacy scanners completely miss.",
  },
  {
    icon: Users,
    title: "RBAC & Logic Testing",
    desc: "Tests role boundaries and multi-step business logic flows — finds the vulnerabilities your pentest team would catch manually.",
  },
];

const steps = [
  { num: "01", title: "Configure", desc: "Enter target URL, credentials, and define user roles" },
  { num: "02", title: "Scan", desc: "Intelligent crawler maps the app, scanner fires payloads across all surfaces" },
  { num: "03", title: "Report", desc: "AI-enriched findings with severity scores, business impact, and fix guidance" },
];

const comparisonRows = [
  { feature: "SPA & JavaScript Support", origin: true, zap: true, burp: true },
  { feature: "AI-Powered Analysis", origin: true, zap: false, burp: false },
  { feature: "RBAC Role Testing", origin: true, zap: false, burp: "partial" },
  { feature: "Business Logic Detection", origin: true, zap: false, burp: "partial" },
  { feature: "API & GraphQL Scanner", origin: true, zap: true, burp: true },
  { feature: "False Positive Reduction", origin: true, zap: false, burp: "partial" },
  { feature: "Real-Time Dashboard", origin: true, zap: true, burp: true },
];

function ComparisonCell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="h-4 w-4 text-severity-low mx-auto" />;
  if (value === false) return <X className="h-4 w-4 text-severity-critical/50 mx-auto" />;
  return <span className="text-xs text-severity-medium">Partial</span>;
}

const Landing = () => {
  const navigate = useNavigate();

  const scrollToDemo = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg text-foreground">Origin</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={scrollToDemo} className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Features
            </button>
            <Button size="sm" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-gradient relative">
        <div className="container py-16 md:py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-3xl sm:text-4xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                Stop Guessing.{" "}
                <span className="text-primary">Start Knowing.</span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-lg leading-relaxed">
                Origin is an AI-powered vulnerability scanner that thinks like an attacker — detecting logic flaws, RBAC gaps, and API exploits that traditional tools miss.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <Button size="lg" onClick={() => navigate("/auth")} className="gap-2">
                  Start Free Scan <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={scrollToDemo} className="gap-2 border-border text-foreground hover:bg-muted">
                  See a Live Demo <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <TerminalAnimation />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-16 md:py-20 border-t border-border/50">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">What Makes Origin Different</h2>
          <p className="text-muted-foreground mt-2">Purpose-built for modern web applications</p>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {features.map((f) => (
            <Card key={f.title} className="bg-card border-border card-hover card-lift cursor-default">
              <CardContent className="p-5 md:p-6 space-y-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container py-16 md:py-20 border-t border-border/50">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">How It Works</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6 md:gap-8">
          {steps.map((s) => (
            <div key={s.num} className="space-y-3">
              <span className="text-4xl font-extrabold text-primary/20">{s.num}</span>
              <h3 className="text-xl font-semibold text-foreground">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="container py-16 md:py-20 border-t border-border/50">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Origin vs. The Competition</h2>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="bg-primary/5 sticky top-0">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Feature</th>
                <th className="text-center py-3 px-4 text-primary font-semibold">Origin</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">OWASP ZAP</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Burp Suite</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr key={row.feature} className={`border-t border-border/50 ${i % 2 === 0 ? "bg-card/50" : ""}`}>
                  <td className="py-3 px-4 text-foreground">{row.feature}</td>
                  <td className="py-3 px-4 text-center"><ComparisonCell value={row.origin} /></td>
                  <td className="py-3 px-4 text-center"><ComparisonCell value={row.zap} /></td>
                  <td className="py-3 px-4 text-center"><ComparisonCell value={row.burp} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card">
        <div className="container py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-bold text-foreground">Origin</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <button onClick={scrollToDemo} className="hover:text-foreground transition-colors">Features</button>
            <span className="hover:text-foreground transition-colors cursor-default">Pricing</span>
            <span className="hover:text-foreground transition-colors cursor-default">Docs</span>
          </div>
          <p className="text-xs text-muted-foreground">Built for the hackathon generation</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
