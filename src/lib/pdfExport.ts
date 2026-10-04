import { jsPDF } from "jspdf";

const NAVY = [27, 42, 74] as const;
const GOLD = [201, 168, 76] as const;
const LIGHT_GRAY = [245, 247, 250] as const;
const MID_GRAY = [107, 122, 153] as const;
const TEXT = [26, 26, 46] as const;

function addHeader(doc: jsPDF, title: string, subtitle: string) {
  // Navy banner
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Digital Footprint Scanner", 14, 12);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GOLD);
  doc.text(title, 14, 20);

  doc.setTextColor(200, 210, 230);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 210 - 14, 20, { align: "right" });

  doc.setTextColor(...TEXT);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(subtitle, 14, 38);

  return 46;
}

function addSectionTitle(doc: jsPDF, label: string, y: number): number {
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(14, y, 182, 7, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text(label.toUpperCase(), 17, y + 5);
  doc.setTextColor(...TEXT);
  return y + 12;
}

function riskLabel(score: number): string {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function riskColor(score: number): [number, number, number] {
  if (score >= 70) return [185, 28, 28];
  if (score >= 40) return [217, 119, 6];
  return [15, 118, 110];
}

// ─── All-scans report (Profile page) ────────────────────────────────────────
export function downloadAllScansPDF(
  user: { name?: string; email?: string } | null,
  scanResults: Record<string, any>
) {
  const doc = new jsPDF();
  let y = addHeader(doc, "Complete Security Report", `Report for: ${user?.name || "User"}`);

  // User info row
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MID_GRAY);
  doc.text(`Email: ${user?.email || "-"}`, 14, y);
  y += 10;

  // Overall risk
  const scores: number[] = Object.values(scanResults)
    .map((r: any) => r?.data?.riskScore ?? null)
    .filter((s): s is number => s !== null);
  const overall = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  if (overall !== null) {
    y = addSectionTitle(doc, "Overall Risk", y);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...riskColor(overall));
    doc.text(`${overall}%`, 14, y + 4);
    doc.setFontSize(11);
    doc.setTextColor(...riskColor(overall));
    doc.text(riskLabel(overall), 38, y + 2);
    doc.setTextColor(...MID_GRAY);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Based on ${scores.length} completed scan${scores.length !== 1 ? "s" : ""}`, 14, y + 12);
    y += 22;
  }

  // Scan results table
  const scanLabels: Record<string, string> = {
    email: "Email Breach Intelligence",
    password: "Password Security",
    username: "Username Footprint",
    phone: "Phone Number Risk",
    image: "Profile Image Search",
    ip: "IP Privacy Scanner",
    fingerprint: "Device Fingerprint",
    phishing: "Phishing Risk Test",
    "phishing-profiler": "Phishing Profiler",
    doxxing: "Doxxing Vulnerability",
    ghost: "Ghost Account Finder",
    network: "Network Exposure",
    session: "Session & Cookie Analyzer",
    metadata: "Image Metadata Detector",
    document: "Document Analyzer",
    cnic: "CNIC Lookup",
  };

  y = addSectionTitle(doc, "Scan Results Summary", y);

  const entries = Object.entries(scanResults);
  if (entries.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...MID_GRAY);
    doc.text("No scans completed yet.", 14, y);
    y += 8;
  } else {
    // Table header
    doc.setFillColor(...NAVY);
    doc.rect(14, y, 182, 7, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Scan Type", 17, y + 5);
    doc.text("Risk Score", 130, y + 5);
    doc.text("Status", 165, y + 5);
    y += 9;

    entries.forEach(([key, result]: [string, any], i) => {
      if (y > 270) { doc.addPage(); y = 20; }

      const bg = i % 2 === 0 ? [255, 255, 255] : [248, 250, 253];
      doc.setFillColor(...(bg as [number, number, number]));
      doc.rect(14, y, 182, 7, "F");

      const data = result?.data ?? result ?? {};
      const score = data?.riskScore ?? null;
      const label = scanLabels[key] || key;
      const status = score !== null ? (score > 60 ? "Issues Found" : score > 30 ? "Warning" : "Secure") : "Scanned";

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...TEXT);
      doc.text(label, 17, y + 5);

      if (score !== null) {
        doc.setTextColor(...riskColor(score));
        doc.text(`${score}%`, 130, y + 5);
        doc.setTextColor(...riskColor(score));
      } else {
        doc.setTextColor(...MID_GRAY);
        doc.text("-", 130, y + 5);
      }

      doc.setTextColor(...MID_GRAY);
      doc.text(status, 165, y + 5);
      doc.setTextColor(...TEXT);
      y += 7;
    });
    y += 4;
  }

  // Email breach detail if exists
  const emailData = scanResults.email?.data;
  if (emailData) {
    if (y > 240) { doc.addPage(); y = 20; }
    y = addSectionTitle(doc, "Email Breach Detail", y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT);
    doc.text(`Scanned email: ${emailData.email || "-"}`, 14, y);
    y += 6;
    doc.text(`Breaches found: ${emailData.breachCount ?? 0}`, 14, y);
    y += 6;
    doc.text(`Risk score: ${emailData.riskScore ?? "-"}%`, 14, y);
    y += 10;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...MID_GRAY);
    doc.text(`Digital Footprint Scanner - Confidential`, 14, 292);
    doc.text(`Page ${p} of ${pageCount}`, 196, 292, { align: "right" });
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(14, 288, 196, 288);
  }

  doc.save(`security-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Email scan specific report ──────────────────────────────────────────────
export function downloadEmailScanPDF(
  email: string,
  riskScore: number,
  breaches: Array<{ name: string; date: string; dataTypes: string[] }>,
  exposedFields: string[],
  recommendations: Array<{ text: string; priority: string }>
) {
  const doc = new jsPDF();
  let y = addHeader(doc, "Email Breach Intelligence Report", `Scanned: ${email}`);

  // Summary row
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MID_GRAY);
  doc.text(`Scan Date: ${new Date().toLocaleString()}`, 14, y);
  y += 10;

  // Risk score block
  y = addSectionTitle(doc, "Risk Assessment", y);
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...riskColor(riskScore));
  doc.text(`${riskScore}%`, 14, y + 8);
  doc.setFontSize(12);
  doc.text(riskLabel(riskScore) + " RISK", 46, y + 5);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MID_GRAY);
  doc.text(`${breaches.length} breach${breaches.length !== 1 ? "es" : ""} found`, 14, y + 18);
  y += 28;

  // Exposed data types
  if (exposedFields.length > 0) {
    y = addSectionTitle(doc, "Exposed Data Types", y);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT);
    const cols = 3;
    exposedFields.forEach((field, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      if (y + row * 6 > 270) return;
      doc.setFillColor(...GOLD);
      doc.circle(14 + col * 62 + 1.5, y + row * 6 + 1, 1.5, "F");
      doc.text(field, 14 + col * 62 + 5, y + row * 6 + 2.5);
    });
    y += Math.ceil(exposedFields.length / cols) * 6 + 8;
  }

  // Breaches table
  if (breaches.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    y = addSectionTitle(doc, "Breach Details", y);

    doc.setFillColor(...NAVY);
    doc.rect(14, y, 182, 7, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Service", 17, y + 5);
    doc.text("Date", 110, y + 5);
    doc.text("Data Types", 145, y + 5);
    y += 9;

    breaches.forEach((b, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const bg = i % 2 === 0 ? [255, 255, 255] : [248, 250, 253];
      doc.setFillColor(...(bg as [number, number, number]));
      doc.rect(14, y, 182, 7, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...TEXT);
      doc.text(b.name || "Unknown", 17, y + 5);
      doc.setTextColor(...MID_GRAY);
      doc.text(b.date || "Unknown", 110, y + 5);
      const types = (b.dataTypes || []).slice(0, 3).join(", ");
      doc.text(types || "-", 145, y + 5);
      y += 7;
    });
    y += 6;
  }

  // Recommendations
  if (recommendations.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    y = addSectionTitle(doc, "Recommendations", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    recommendations.slice(0, 10).forEach((rec, i) => {
      if (y > 272) { doc.addPage(); y = 20; }
      const col = rec.priority === "critical" ? [185, 28, 28] : rec.priority === "high" ? [217, 119, 6] : rec.priority === "medium" ? [37, 99, 235] : [...MID_GRAY];
      doc.setFillColor(...(col as [number, number, number]));
      doc.circle(17, y + 1.5, 1.5, "F");
      doc.setTextColor(...TEXT);
      const lines = doc.splitTextToSize(rec.text, 172);
      doc.text(lines, 21, y + 2.5);
      y += lines.length * 5 + 3;
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...MID_GRAY);
    doc.text(`Digital Footprint Scanner - Confidential`, 14, 292);
    doc.text(`Page ${p} of ${pageCount}`, 196, 292, { align: "right" });
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(14, 288, 196, 288);
  }

  doc.save(`email-breach-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
