import { jsPDF } from "jspdf";
import QRCode from "qrcode";

export interface DriverQrPdfInput {
  qrPayload: string;
  driverName: string;
  busNumber: string;
  mobileUsername: string;
  /** Shown only if 6 digits */
  pin?: string | null;
  /** Login page URL (https://…) */
  loginUrl: string;
  /** School / product line shown at top */
  schoolBrand?: string;
  productLine?: string;
}

function safeFilePart(s: string): string {
  const t = s.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return t.slice(0, 48) || "driver";
}

/**
 * A4 portrait PDF: school branding, driver name, QR, numbered login steps (print-ready).
 */
export async function downloadDriverQrPdf(input: DriverQrPdfInput): Promise<void> {
  const school = (input.schoolBrand ?? process.env.NEXT_PUBLIC_SCHOOL_BRAND_NAME ?? "Sishu Tirtha").trim();
  const product = (input.productLine ?? process.env.NEXT_PUBLIC_PRODUCT_LINE ?? "Safe Route").trim();
  const loginUrl = input.loginUrl.trim() || "https://";

  const dataUrl = await QRCode.toDataURL(input.qrPayload, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(school, pageW / 2, 12, { align: "center" });
  doc.setFontSize(11);
  doc.text(product, pageW / 2, 21, { align: "center" });

  doc.setTextColor(15, 23, 42);
  y = 38;
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Driver login — QR card", margin, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Printed: ${new Date().toLocaleString()}`, margin, y);
  y += 12;

  const qrSize = 72;
  doc.addImage(dataUrl, "PNG", margin, y, qrSize, qrSize);

  const col2 = margin + qrSize + 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Driver", col2, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(input.driverName || "—", col2, y + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Bus", col2, y + 26);
  doc.setFont("helvetica", "normal");
  doc.text(input.busNumber || "—", col2 + 18, y + 26);

  doc.setFont("helvetica", "bold");
  doc.text("Mobile (username)", col2, y + 34);
  doc.setFont("helvetica", "normal");
  doc.text(input.mobileUsername || "—", col2, y + 41);

  if (input.pin && /^\d{6}$/.test(input.pin)) {
    doc.setFont("helvetica", "bold");
    doc.text("6-digit PIN", col2, y + 49);
    doc.setFont("courier", "bold");
    doc.setFontSize(12);
    doc.text(input.pin, col2, y + 56);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
  }

  y += qrSize + 14;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("How to sign in", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  const steps = [
    `Open the login page: ${loginUrl}`,
    "Choose Driver.",
    "Either scan this QR code with Driver → Scan QR, or enter the mobile number above and your 6-digit PIN.",
    "Allow location when prompted so parents and school can see the bus during trips.",
    "Keep this sheet secure; renew the QR from Admin if it is lost or shared.",
  ];

  const lineH = 5.2;
  for (let i = 0; i < steps.length; i++) {
    const lines = doc.splitTextToSize(`${i + 1}. ${steps[i]}`, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * lineH + 2;
  }

  y += 4;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`${school} ${product} — for official school use only.`, margin, y);

  const name = safeFilePart(input.driverName);
  doc.save(`driver-qr-${name}.pdf`);
}
