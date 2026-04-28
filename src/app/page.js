"use client";

import { useState, useRef } from "react";
import RingWorkspace from "@/components/RingWorkspace";
import { EXAMPLE_RINGS } from "@/utils/audioUtils";

export default function Home() {
  const [selectedRing, setSelectedRing] = useState(null);
  const ringsRef = useRef(null);

  const scrollToRings = () => {
    ringsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (selectedRing) {
    return (
      <main className="container fade-in">
        <RingWorkspace ring={selectedRing} onBack={() => setSelectedRing(null)} />
      </main>
    );
  }

  // Get unique contributors across all rings
  const getContributors = (ring) => {
    const users = [...new Set(ring.snippets.map((s) => s.user))];
    return users;
  };

  // Generate avatar colors deterministically
  const avatarColor = (name) => {
    const colors = [
      "var(--accent-primary)",
      "var(--accent-secondary)",
      "var(--accent-tertiary)",
      "var(--success)",
      "var(--warning)",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  // Mini static waveform heights per role
  const waveHeights = (tags) => {
    const base = tags.includes("beat") ? [12, 18, 8, 16, 10, 14, 6, 15] : [6, 10, 14, 10, 8, 12, 9, 7];
    return base;
  };

  return (
    <main className="container fade-in">
      <header className="hero">
        <h1>RhythmRing</h1>
        <p>
          Collaborate with the world by turning everyday sounds into community-made music.
          No instruments required—just your voice and your rhythm.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            className="btn btn-primary"
            onClick={() =>
              setSelectedRing({
                id: Date.now(),
                name: "New Jam",
                genre: "Experimental",
                snippets: [],
              })
            }
          >
            🎵 Create New Ring
          </button>
          <button className="btn btn-secondary" onClick={scrollToRings}>
            🔍 Explore Rings
          </button>
        </div>
      </header>

      {/* How It Works */}
      <section style={{ marginTop: "3rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem", textAlign: "center" }}>
          {[
            { icon: "🎤", title: "Record", desc: "Capture any sound — a tap, hum, or clap" },
            { icon: "🤖", title: "AI Analyzes", desc: "Gemini identifies the musical role" },
            { icon: "🔗", title: "Layer", desc: "Your sound joins the collaborative ring" },
            { icon: "🎶", title: "Play", desc: "Listen to the community-made track" },
          ].map((step, i) => (
            <div key={i} className="glass" style={{ padding: "1.5rem", borderRadius: "16px" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{step.icon}</div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>{step.title}</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Active Rings */}
      <section ref={ringsRef} style={{ marginTop: "4rem" }}>
        <div className="section-header">
          <h2>Active Rings</h2>
          <span className="stat-pill">🔥 {EXAMPLE_RINGS.length} live</span>
        </div>

        <div className="ring-grid">
          {EXAMPLE_RINGS.map((ring) => {
            const contributors = getContributors(ring);
            const heights = waveHeights(ring.tags);
            return (
              <div key={ring.id} className="glass ring-card" onClick={() => setSelectedRing(ring)}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <span className={`tag tag-${ring.tags[0]}`}>{ring.genre}</span>
                  <span className="stat-pill">🎧 {ring.sounds} snippets</span>
                </div>

                <h3 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{ring.name}</h3>

                {/* Mini waveform preview */}
                <div className="mini-wave" style={{ color: "var(--accent-primary)", marginBottom: "0.75rem" }}>
                  {heights.map((h, i) => (
                    <span key={i} style={{ height: `${h}px` }} />
                  ))}
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                  {ring.tags.map((tag) => (
                    <span key={tag} className={`tag tag-${tag}`}>{tag}</span>
                  ))}
                </div>

                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="avatar-stack">
                    {contributors.slice(0, 4).map((user) => (
                      <div key={user} className="avatar" style={{ background: avatarColor(user) }}>
                        {user[0]}
                      </div>
                    ))}
                    {contributors.length > 4 && (
                      <div className="avatar" style={{ background: "var(--panel-bg)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                        +{contributors.length - 4}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>by {ring.creator}</span>
                </div>
              </div>
            );
          })}

          {/* Create New Card */}
          <div
            className="glass ring-card"
            style={{
              borderStyle: "dashed",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "200px",
            }}
            onClick={() =>
              setSelectedRing({
                id: Date.now(),
                name: "New Jam",
                genre: "Experimental",
                snippets: [],
              })
            }
          >
            <div style={{ fontSize: "2.5rem", color: "var(--accent-primary)", marginBottom: "0.5rem" }}>+</div>
            <p style={{ fontWeight: "600", fontSize: "1.1rem" }}>Start a Ring</p>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
              Record or upload a sound to begin
            </p>
          </div>
        </div>
      </section>

      <footer style={{ marginTop: "6rem", textAlign: "center", paddingBottom: "4rem", color: "var(--text-secondary)" }}>
        <p>© 2026 RhythmRing. Powered by Gemini AI.</p>
      </footer>
    </main>
  );
}
