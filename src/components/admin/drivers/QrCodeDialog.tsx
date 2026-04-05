"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { FileDown, MessageCircle, QrCode, Shield } from "lucide-react";
import { driverWelcomeMessage, openWhatsAppInvite } from "@/utils/whatsappInvite";
import { downloadDriverQrPdf } from "@/utils/driverQrPdf";
import { toast } from "sonner";

interface DriverCredentials {
  username: string;
  password: string;
}

interface QrCodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  qrCodeData: string | null;
  credentials: DriverCredentials | null;
  /** Login page URL for printed instructions (e.g. window.location.origin). */
  loginPageUrl: string;
  /** When set, shows a button to open WhatsApp with a welcome message (wa.me). */
  welcomeContext?: {
    name: string;
    mobile: string;
    busNumber: string;
    /** Include in WhatsApp text and on-screen when the driver was just created. */
    pin?: string;
  } | null;
}

const QrCodeDialog: React.FC<QrCodeDialogProps> = ({
  isOpen,
  onClose,
  qrCodeData,
  credentials,
  loginPageUrl,
  welcomeContext,
}) => {
  const [pdfLoading, setPdfLoading] = useState(false);

  const sendWelcomeWa = () => {
    if (!welcomeContext) return;
    const pin =
      welcomeContext.pin && /^\d{6}$/.test(welcomeContext.pin)
        ? welcomeContext.pin
        : undefined;
    openWhatsAppInvite(
      welcomeContext.mobile,
      driverWelcomeMessage({
        name: welcomeContext.name,
        mobile: welcomeContext.mobile,
        busNumber: welcomeContext.busNumber,
        pin,
      }),
    );
  };

  const handleDownloadPdf = async () => {
    if (!qrCodeData || !credentials) {
      toast.error("QR or login details are missing.");
      return;
    }
    setPdfLoading(true);
    try {
      await downloadDriverQrPdf({
        qrPayload: qrCodeData,
        driverName: welcomeContext?.name ?? "Driver",
        busNumber: welcomeContext?.busNumber ?? "—",
        mobileUsername: credentials.username,
        pin: welcomeContext?.pin,
        loginUrl: loginPageUrl.trim() || "https://",
      });
      toast.success("PDF downloaded (A4, ready to print).");
    } catch (e) {
      console.error(e);
      toast.error("Could not create PDF. Try again or use a different browser.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Driver QR & login details
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Drivers scan this in the app (<strong>Driver → QR</strong>). The code is tied to this
            account and rotates when you tap renew.
          </p>
          {qrCodeData && (
            <div className="rounded-2xl border-2 border-border bg-white p-4 shadow-inner">
              <QRCodeSVG value={qrCodeData} size={240} level="M" />
            </div>
          )}

          {credentials && (
            <div className="w-full space-y-2 rounded-xl border bg-muted/40 p-4 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Mobile (username)</span>
                <span className="font-mono font-medium">{credentials.username}</span>
              </div>
              {welcomeContext?.pin && /^\d{6}$/.test(welcomeContext.pin) ? (
                <div className="flex justify-between gap-2 border-t border-border/60 pt-2">
                  <span className="text-muted-foreground">6-digit PIN</span>
                  <span className="font-mono text-base font-semibold tracking-widest">
                    {welcomeContext.pin}
                  </span>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                <QrCode className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
                QR signs in without typing the PIN. Mobile login uses username + PIN above.
              </p>
            </div>
          )}

          <Button
            type="button"
            variant="default"
            className="w-full gap-2"
            disabled={!qrCodeData || !credentials || pdfLoading}
            onClick={() => void handleDownloadPdf()}
          >
            <FileDown className="h-4 w-4" />
            {pdfLoading ? "Building PDF…" : "Download A4 PDF (print)"}
          </Button>

          {welcomeContext && (
            <Button type="button" variant="secondary" className="w-full gap-2" onClick={sendWelcomeWa}>
              <MessageCircle className="h-4 w-4" />
              WhatsApp — mobile, PIN & bus
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QrCodeDialog;
