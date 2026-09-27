"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { debriefText } from "@/lib/debrief";
import { buildReportPdf, reportFileName } from "@/lib/reportPdf";
import type { OperativeReport } from "@/lib/types";

export interface ShareCaps {
  telegram: boolean;
  email: boolean;
}

interface Props {
  report: OperativeReport;
  caps: ShareCaps;
  speaking: boolean;
  onSpeak: (text: string) => void;
  onStopSpeaking: () => void;
}

const TG_KEY = "surgr.telegram.chat";
const TG_NAME_KEY = "surgr.telegram.name";

function captionFor(r: OperativeReport): string {
  const q = r.communication_quality;
  return `Surgr operative communication record · ${new Date(r.generated_at).toLocaleString()} · ${q.confirmed_orders}/${q.total_orders} orders closed (${Math.round(q.closed_loop_rate * 100)}%) · ${r.safety_events.length} safety event${r.safety_events.length === 1 ? "" : "s"}`;
}

export default function DeliverBar({ report, caps, speaking, onSpeak, onStopSpeaking }: Props) {
  const pdfCache = useRef<{ key: string; file: File } | null>(null);
  // Mounted client-side only (inside the report modal), so browser APIs are safe in initialisers.
  const [canShare] = useState(() => typeof navigator !== "undefined" && typeof navigator.canShare === "function");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [tgLink, setTgLink] = useState<{ deepLink: string; botUsername: string; code: string } | null>(null);
  const [tgName, setTgName] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TG_KEY) ? localStorage.getItem(TG_NAME_KEY) : null;
    } catch {
      return null;
    }
  });
  const [email, setEmail] = useState("");
  const pollRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    },
    [],
  );

  const getPdf = useCallback(async (): Promise<File> => {
    if (pdfCache.current?.key === report.generated_at) return pdfCache.current.file;
    const bytes = await buildReportPdf(report);
    const file = new File([bytes as BlobPart], reportFileName(report), { type: "application/pdf" });
    pdfCache.current = { key: report.generated_at, file };
    return file;
  }, [report]);

  const download = async () => {
    setBusy("pdf");
    try {
      const file = await getPdf();
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      setNote({ tone: "ok", text: `Saved ${file.name}` });
    } catch (e) {
      setNote({ tone: "warn", text: e instanceof Error ? e.message : "Could not build the PDF" });
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy("share");
    try {
      const file = await getPdf();
      const data = { title: report.title, text: captionFor(report), files: [file] };
      if (!navigator.canShare?.(data)) throw new Error("This browser cannot share files; use Download PDF instead.");
      await navigator.share(data);
      setNote({ tone: "ok", text: "Shared." });
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError")) setNote({ tone: "warn", text: e instanceof Error ? e.message : "Share failed" });
    } finally {
      setBusy(null);
    }
  };

  const sendTelegram = useCallback(
    async (chat: string) => {
      const file = await getPdf();
      const form = new FormData();
      form.set("chat", chat);
      form.set("caption", captionFor(report));
      form.set("file", file, file.name);
      const res = await fetch("/api/share/telegram/send", { method: "POST", body: form });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Telegram send failed");
    },
    [getPdf, report],
  );

  const telegram = async () => {
    setNote(null);
    let chat: string | null = null;
    try {
      chat = localStorage.getItem(TG_KEY);
    } catch {
      /* ignore */
    }
    if (chat) {
      setBusy("telegram");
      try {
        await sendTelegram(chat);
        setNote({ tone: "ok", text: `Sent to ${tgName ?? "Telegram"}.` });
      } catch (e) {
        setNote({ tone: "warn", text: e instanceof Error ? e.message : "Telegram send failed" });
      } finally {
        setBusy(null);
      }
      return;
    }
    setBusy("telegram-link");
    try {
      const res = await fetch("/api/share/telegram/link", { cache: "no-store" });
      const data = (await res.json()) as { code?: string; deepLink?: string; botUsername?: string; error?: string };
      if (!res.ok || !data.code || !data.deepLink || !data.botUsername) throw new Error(data.error ?? "Could not start a Telegram link");
      setTgLink({ code: data.code, deepLink: data.deepLink, botUsername: data.botUsername });
      window.open(data.deepLink, "_blank", "noopener");
      let tries = 0;
      pollRef.current = window.setInterval(async () => {
        tries += 1;
        if (tries > 60) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setBusy(null);
          setNote({ tone: "warn", text: "Telegram link timed out. Press Start in the bot, then try again." });
          return;
        }
        try {
          const s = await fetch(`/api/share/telegram/status?code=${encodeURIComponent(data.code!)}`, { cache: "no-store" });
          const st = (await s.json()) as { linked?: boolean; chat?: string; name?: string };
          if (st.linked && st.chat) {
            if (pollRef.current) window.clearInterval(pollRef.current);
            try {
              localStorage.setItem(TG_KEY, st.chat);
              localStorage.setItem(TG_NAME_KEY, st.name ?? "Telegram");
            } catch {
              /* ignore */
            }
            setTgName(st.name ?? "Telegram");
            setTgLink(null);
            await sendTelegram(st.chat);
            setNote({ tone: "ok", text: `Linked and sent to ${st.name ?? "Telegram"}.` });
            setBusy(null);
          }
        } catch (e) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setBusy(null);
          setNote({ tone: "warn", text: e instanceof Error ? e.message : "Telegram link failed" });
        }
      }, 2000);
    } catch (e) {
      setBusy(null);
      setNote({ tone: "warn", text: e instanceof Error ? e.message : "Telegram unavailable" });
    }
  };

  const forgetTelegram = () => {
    try {
      localStorage.removeItem(TG_KEY);
      localStorage.removeItem(TG_NAME_KEY);
    } catch {
      /* ignore */
    }
    setTgName(null);
    setNote({ tone: "ok", text: "Telegram unlinked." });
  };

  const sendEmail = async () => {
    setBusy("email");
    setNote(null);
    try {
      const file = await getPdf();
      const form = new FormData();
      form.set("to", email.trim());
      form.set("subject", `${report.title} — ${new Date(report.generated_at).toLocaleDateString()}`);
      form.set("text", `${captionFor(report)}\n\n${report.procedure_summary}`);
      form.set("file", file, file.name);
      const res = await fetch("/api/share/email", { method: "POST", body: form });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Email failed");
      setNote({ tone: "ok", text: `Emailed to ${email.trim()}.` });
    } catch (e) {
      setNote({ tone: "warn", text: e instanceof Error ? e.message : "Email failed" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="deliver">
      <div className="deliver-row">
        <span className="deliver-label">Deliver</span>
        <button className="btn btn-small btn-primary" onClick={download} disabled={busy === "pdf"}>
          {busy === "pdf" ? "Building…" : "Download PDF"}
        </button>
        {canShare && (
          <button className="btn btn-small" onClick={share} disabled={busy === "share"}>
            Share…
          </button>
        )}
        <button
          className={`btn btn-small ${speaking ? "btn-danger" : ""}`}
          onClick={() => (speaking ? onStopSpeaking() : onSpeak(debriefText(report)))}
          title="Surgr reads the debrief aloud through the Voice Agent"
        >
          {speaking ? "Stop debrief" : "Spoken debrief"}
        </button>
        <button
          className="btn btn-small"
          onClick={telegram}
          disabled={!caps.telegram || busy === "telegram" || busy === "telegram-link"}
          title={caps.telegram ? (tgName ? `Send to ${tgName}` : "Link your Telegram and send the PDF") : "Set TELEGRAM_BOT_TOKEN to enable"}
        >
          {busy === "telegram-link" ? "Waiting for Start…" : busy === "telegram" ? "Sending…" : tgName ? `Telegram · ${tgName}` : "Send to Telegram"}
        </button>
        {tgName && caps.telegram && (
          <button className="btn btn-small btn-ghost" onClick={forgetTelegram} title="Link a different Telegram account">
            Unlink
          </button>
        )}
        <form
          className="deliver-email"
          onSubmit={(e) => {
            e.preventDefault();
            void sendEmail();
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={caps.email ? "name@hospital.org" : "Email needs RESEND_API_KEY"}
            disabled={!caps.email}
            aria-label="Recipient email"
          />
          <button className="btn btn-small" type="submit" disabled={!caps.email || busy === "email" || !email.trim()}>
            {busy === "email" ? "Sending…" : "Email PDF"}
          </button>
        </form>
      </div>
      {tgLink && (
        <div className="deliver-note">
          Open <a href={tgLink.deepLink} target="_blank" rel="noopener noreferrer">@{tgLink.botUsername}</a> in Telegram and press <strong>Start</strong>. The report is sent the moment the link is confirmed.
        </div>
      )}
      {note && <div className={`deliver-note ${note.tone === "warn" ? "deliver-warn" : ""}`}>{note.text}</div>}
    </div>
  );
}
