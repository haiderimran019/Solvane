import { ArrowRight, ArrowUp, Check, ChevronRight, CircleAlert, Clipboard, Database, Download, Gauge, History, Pencil, ShieldCheck, Sparkles, Target, Zap } from "lucide-react";
import { useState } from "react";
import { PROVIDERS, type ProviderId, type RelaySnapshot } from "../../lib/product";
import { type FolderSummary, type HandoffRecord, ProviderMark, formatRelative } from "./shared";

// Shown until all three steps are done or the person hides it. Step 1 comes first because Claude's update
// blocks only exist once its project instructions ask for them.
export function SetupCard({ steps, onCopyInstruction, onSave, onDismiss }: { steps: { instruction: boolean; installed: boolean; saved: boolean }; onCopyInstruction: () => void; onSave: () => void; onDismiss: () => void }) {
  const rows = [
    { done: steps.instruction, title: "Add Solvane's instruction to your Claude project", copy: "Paste it once into the project's custom instructions. Claude then ends useful replies with an update block that saves without Gemini.", action: <button className="secondary-action" onClick={onCopyInstruction}><Clipboard size={14} /> Copy instruction</button> },
    { done: steps.installed, title: "Install the browser extension", copy: "Unzip it, then choose Load unpacked in chrome://extensions. It adds Save progress to Claude and ChatGPT.", action: <a className="secondary-action" href="/solvane-extension.zip" download><Download size={14} /> Download</a> },
    { done: steps.saved, title: "Save your first progress", copy: "In Claude, click Save progress or press Alt+S (Option+S on a Mac). You can also paste here.", action: <button className="secondary-action" onClick={onSave}><Sparkles size={14} /> Save progress</button> },
  ];
  return <section className="setup-card" aria-labelledby="setup-title"><div className="card-topline"><span className="soft-icon"><Zap size={17} /></span><span id="setup-title">Set up in 3 steps</span><button onClick={onDismiss}>Hide</button></div><ol>{rows.map((row, index) => <li key={row.title} className={row.done ? "done" : ""}><b aria-hidden="true">{row.done ? <Check size={13} /> : index + 1}</b><span><strong>{row.title}</strong><small>{row.copy}</small></span>{row.done ? <em>Done</em> : row.action}</li>)}</ol></section>;
}

export function ProjectTitle({ name, onRename }: { name: string; onRename: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const finish = async () => { setEditing(false); if (value.trim() && value.trim() !== name) await onRename(value.trim()); else setValue(name); };
  if (editing) return <form className="title-form" onSubmit={(event) => { event.preventDefault(); void finish(); }}><input className="title-input" aria-label="Project name" autoFocus maxLength={80} value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => void finish()} onKeyDown={(event) => { if (event.key === "Escape") { setValue(name); setEditing(false); } }} /></form>;
  return <h1>{name}<button className="title-edit" onClick={() => { setValue(name); setEditing(true); }} aria-label="Rename project" title="Rename project"><Pencil size={16} /></button></h1>;
}

export function ContinuityHome({ project, state, version, createdAt, tokenEstimate, contextHealth, handoffs, setup, source, target, onRename, onSave, onContinue, onPreview, onOpenMemory }: { project: FolderSummary; state: RelaySnapshot; version: number; createdAt: string | null; tokenEstimate: number; contextHealth: number; handoffs: HandoffRecord[]; setup: React.ReactNode; source: ProviderId; target: ProviderId; onRename: (name: string) => Promise<void>; onSave: () => void; onContinue: () => void; onPreview: () => void; onOpenMemory: () => void }) {
  const ready = contextHealth >= 75;
  const from = PROVIDERS[source].name, to = PROVIDERS[target].name;
  return <div className="continuity-home">
    <section className="continuity-hero">
      <div className="hero-copy">
        <div className="live-status"><i /> {createdAt ? `Saved ${formatRelative(createdAt)}` : "Ready for your first save"}</div>
        <p className="eyebrow">Active project</p>
        <ProjectTitle key={project.id} name={project.name} onRename={onRename} />
        <p className="hero-description">Work in {from}. Solvane keeps the important state ready, so {to} can continue without you explaining everything again.</p>
        <div className="hero-actions">
          <button className="continue-primary" onClick={onContinue}><span><ProviderMark provider={target} small /><b>Continue in {to}</b></span><ArrowRight size={18} /></button>
        </div>
        <p className="trust-line"><ShieldCheck size={14} /> You review what moves. Solvane never presses Send.</p>
      </div>
      <div className="continuity-orbit" aria-label={`${from} to ${to} continuity status`}>
        <div className="orbit-provider source"><ProviderMark provider={source} /><span><strong>{from}</strong><small>Current work</small></span></div>
        <div className="orbit-path"><i /><span className="orbit-capsule"><Sparkles size={21} /></span><i /></div>
        <div className="orbit-provider target"><ProviderMark provider={target} /><span><strong>{to}</strong><small>Next</small></span></div>
        {/* Reports the real capsule: nothing saved, saved but thin, or ready. */}
        <div className={version && ready ? "orbit-note" : "orbit-note attention"}>{version && ready ? <Check size={14} /> : <CircleAlert size={14} />}<span><strong>{!version ? "Nothing saved yet" : ready ? "Ready to continue" : "Capsule needs more context"}</strong><small>{version ? `Capsule v${version} · ${tokenEstimate} tokens` : "Save progress to create the first capsule"}</small></span></div>
      </div>
    </section>

    <button className="continuity-composer" onClick={onSave} aria-label="Save the latest project progress">
      <span className="composer-spark"><Sparkles size={18} /></span>
      <span className="composer-copy"><strong>Save what changed…</strong><small>Paste the latest exchange or use the browser chip</small></span>
      <kbd>Alt S</kbd>
      <span className="composer-send"><ArrowUp size={18} /></span>
    </button>

    {setup}

    <section className="continuity-grid">
      <article className="next-card">
        <div className="card-topline"><span className="soft-icon"><Target size={17} /></span><span>Next action</span><button onClick={onPreview}>Review memory</button></div>
        <h2>{state.nextAction || "Save your latest work to set the next action."}</h2>
        <div className="project-now"><span><b>Working on</b>{state.currentTask || "Project state not established yet."}</span><ChevronRight size={18} /></div>
      </article>

      <article className="readiness-card">
        <div className="readiness-head"><span><Gauge size={16} /> Handoff readiness</span><strong>{contextHealth}%</strong></div>
        <div className="readiness-track"><i style={{ width: `${contextHealth}%` }} /></div>
        <p>{ready ? "Everything important is ready to carry forward." : "Save the latest chat before moving so the next model gets the full picture."}</p>
        <div className="readiness-facts"><span><Check size={13} /> Saved only after your review</span><span><ShieldCheck size={13} /> Common secret formats redacted</span></div>
      </article>

      <article className="memory-card">
        <div className="card-topline"><span className="soft-icon"><Database size={17} /></span><span>What Solvane remembers</span><button onClick={onOpenMemory}>Trust preview</button></div>
        <div className="memory-summary">
          <div><strong>{state.decisions.length}</strong><span>decisions</span></div>
          <div><strong>{state.completed.length}</strong><span>completed</span></div>
          <div><strong>{state.openQuestions.length}</strong><span>open questions</span></div>
        </div>
        <p>{state.objective || "Your project goal will appear here after the first save."}</p>
      </article>

      <article className="recent-continuity-card">
        <div className="card-topline"><span className="soft-icon"><History size={17} /></span><span>Recent continuity</span></div>
        {handoffs.length ? handoffs.slice(0, 2).map((handoff) => <div className="continuity-row" key={handoff.id}><ProviderMark provider={handoff.target} small /><span><strong>Continued in {PROVIDERS[handoff.target].name}</strong><small>v{handoff.snapshotVersion} · {formatRelative(handoff.createdAt)}</small></span><Check size={14} /></div>) : <div className="continuity-empty"><Sparkles size={18} /><span><strong>Your first handoff starts here</strong><small>Save in Claude, then continue in ChatGPT.</small></span></div>}
      </article>
    </section>
  </div>;
}
