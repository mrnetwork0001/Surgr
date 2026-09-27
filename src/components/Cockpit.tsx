"use client";
import { useSurgr } from "@/hooks/useSurgr";
import AlertBanner from "./AlertBanner";
import ORBackdrop from "./landing/ORBackdrop";
import ChecklistPanel from "./ChecklistPanel";
import Header from "./Header";
import OrderBoard from "./OrderBoard";
import ReportModal from "./ReportModal";
import Simulator from "./Simulator";
import TranscriptFeed from "./TranscriptFeed";

export default function Cockpit() {
  const surgr = useSurgr();
  const { state } = surgr;

  return (
    <div className="cockpit">
      <div className="cockpit-backdrop" aria-hidden>
        <ORBackdrop variant="cockpit" intensity={0.6} />
      </div>
      <Header surgr={surgr} />
      <AlertBanner alerts={surgr.unacknowledged} onAck={surgr.ackAlert} onAckAll={surgr.ackAllAlerts} voiceStatus={surgr.voice.status} />
      <main className="main">
        <section className="panel panel-transcript">
          <TranscriptFeed
            turns={state.turns}
            speakerRoles={state.speakerRoles}
            speakerLabels={surgr.speakerLabels}
            onAssignRole={surgr.assignRole}
            highlightTurnId={surgr.highlightTurnId}
            sttStatus={surgr.stt.status}
            micLevel={surgr.stt.level}
          />
        </section>
        <section className="panel panel-orders">
          <OrderBoard orders={state.orders} speakerRoles={state.speakerRoles} />
        </section>
        <section className="panel panel-checklist">
          <ChecklistPanel checklist={state.checklist} phase={state.phase} phaseHistory={state.phaseHistory} />
        </section>
      </main>
      <Simulator
        sim={surgr.sim}
        speed={surgr.simSpeed}
        onSpeed={surgr.setSimSpeed}
        onPlay={surgr.playScenario}
        onStop={surgr.stopScenario}
        onInject={surgr.injectLine}
      />
      {surgr.report && (
        <ReportModal
          result={surgr.report}
          onClose={surgr.closeReport}
          onJump={surgr.jumpToTurn}
          onRetry={surgr.generateReport}
          retrying={surgr.reportLoading}
          caps={surgr.caps}
          speaking={surgr.voice.status === "speaking" || surgr.voice.status === "fallback" || surgr.voice.status === "connecting"}
          onSpeak={surgr.speakText}
          onStopSpeaking={surgr.stopSpeaking}
        />
      )}
    </div>
  );
}
