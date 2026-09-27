"use client";
import Image from "next/image";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { Surgr } from "@/hooks/useSurgr";
import { SessionActions, SessionToggles, StatusPills } from "./Header";

interface Props {
  surgr: Surgr;
  open: boolean;
  onClose: () => void;
}

const PANELS = [
  { id: "panel-transcript", label: "Live transcript" },
  { id: "panel-orders", label: "Closed-loop orders" },
  { id: "panel-checklist", label: "WHO checklist" },
  { id: "panel-simulator", label: "OR audio simulator" },
];

/** Full-height left drawer for small screens: panel navigation, service status, toggles and session actions. */
export default function MobileDrawer({ surgr, open, onClose }: Props) {
  if (typeof document === "undefined") return null;
  const jump = (id: string) => {
    onClose();
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="drawer-backdrop"
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            key="drawer"
            id="cockpit-menu"
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Cockpit menu"
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
          >
            <div className="drawer-head">
              <Image src="/brand/surgr-header.png" alt="Surgr" width={1086} height={362} className="brand-logo brand-logo-drawer" />
              <button type="button" className="drawer-close" onClick={onClose} aria-label="Close menu">
                ×
              </button>
            </div>

            <div className="drawer-title">On this screen</div>
            <nav className="drawer-nav" aria-label="Panels">
              {PANELS.map((p) => (
                <button key={p.id} type="button" onClick={() => jump(p.id)}>
                  {p.label}
                </button>
              ))}
            </nav>

            <div className="drawer-title">Session</div>
            <div className="drawer-actions">
              <SessionActions surgr={surgr} onDone={onClose} />
            </div>
            <div className="drawer-toggles">
              <SessionToggles surgr={surgr} />
            </div>

            <div className="drawer-title">Services</div>
            <div className="drawer-status">
              <StatusPills surgr={surgr} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
