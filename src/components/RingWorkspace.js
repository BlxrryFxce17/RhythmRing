"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import RecordingComponent from "./RecordingComponent";
import { getAudioContext, playSnippet, playAllSnippets } from "@/utils/audioUtils";

export default function RingWorkspace({ ring, onBack }) {
  const [snippets, setSnippets] = useState(() => {
    // Use pre-built snippets from ring data, or defaults
    if (ring.snippets && ring.snippets.length > 0) {
      return ring.snippets.map((s) => ({
        ...s,
        color:
          s.role === "beat"
            ? "var(--accent-primary)"
            : s.role === "melody"
            ? "var(--accent-secondary)"
            : s.role === "vocal"
            ? "var(--accent-tertiary)"
            : "var(--success)",
      }));
    }
    return [];
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [playingSnippetId, setPlayingSnippetId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [hoveredNode, setHoveredNode] = useState(null);
  const playTimerRef = useRef(null);
  const progressTimerRef = useRef(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const handleNewSnippet = useCallback((analysis) => {
    const roleColors = {
      beat: "var(--accent-primary)",
      melody: "var(--accent-secondary)",
      vocal: "var(--accent-tertiary)",
      texture: "var(--success)",
    };
    const newSnippet = {
      id: Date.now(),
      role: analysis.role || "texture",
      description: analysis.description || "New sound",
      user: "You",
      note: "C4",
      variant: Math.floor(Math.random() * 3),
      color: roleColors[analysis.role] || "var(--accent-tertiary)",
      bpm: analysis.bpm,
      mood: analysis.mood,
    };
    setSnippets((prev) => [...prev, newSnippet]);
  }, []);

  const handlePlaySnippet = useCallback((snippet) => {
    const ctx = getAudioContext();
    setPlayingSnippetId(snippet.id);
    const duration = playSnippet(ctx, snippet);
    // Reset playing state after sound finishes
    setTimeout(() => setPlayingSnippetId(null), duration * 1000 + 50);
  }, []);

  const handlePlayAll = useCallback(() => {
    if (snippets.length === 0) return;

    if (isPlaying) {
      // Stop
      setIsPlaying(false);
      setProgress(0);
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      return;
    }

    const ctx = getAudioContext();
    const totalDuration = playAllSnippets(ctx, snippets);
    setIsPlaying(true);
    setProgress(0);

    // Animate progress bar
    const startTime = Date.now();
    const durationMs = totalDuration * 1000;
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / durationMs) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(progressTimerRef.current);
      }
    }, 50);

    playTimerRef.current = setTimeout(() => {
      setIsPlaying(false);
      setProgress(0);
      clearInterval(progressTimerRef.current);
    }, durationMs + 100);
  }, [snippets, isPlaying]);

  const roleIcon = (role) => {
    switch (role) {
      case "beat": return "🥁";
      case "melody": return "🎵";
      case "vocal": return "🎤";
      case "texture": return "🌊";
      default: return "🎶";
    }
  };

  return (
    <div className="fade-in">
      <button onClick={onBack} className="btn btn-secondary" style={{ marginBottom: "2rem" }}>
        ← Back to Dashboard
      </button>

      <div className="glass" style={{ padding: "2rem 2rem 3rem", position: "relative", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>{ring.name}</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            A <span style={{ color: "var(--accent-primary)" }}>{ring.genre}</span> collaboration
            {snippets.length > 0 && ` · ${snippets.length} sounds layered`}
          </p>
        </div>

        {/* Ring Visualization */}
        <div className={`ring-container ${isPlaying ? "ring-playing" : ""}`}>
          <div className="main-ring" />
          <div className="ring-inner">
            <h3 style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>{snippets.length}</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
              Sounds Layered
            </p>

            {/* Play / Stop button */}
            <button
              className={`btn ${isPlaying ? "btn-danger" : "btn-primary"}`}
              style={{ padding: "0.5rem 1.25rem" }}
              onClick={handlePlayAll}
              disabled={snippets.length === 0}
            >
              {isPlaying ? "■ Stop" : "▶ Play Track"}
            </button>

            {/* Waveform when playing */}
            {isPlaying && (
              <div className="waveform-container" style={{ marginTop: "0.5rem" }}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="waveform-bar" />
                ))}
              </div>
            )}
          </div>

          {/* Sound Nodes on the Ring — clickable to play individual sounds */}
          {snippets.map((s, i) => {
            const angle = (i / snippets.length) * 360;
            const isNodePlaying = playingSnippetId === s.id;
            const nodeSize = isNodePlaying ? 50 : 40;
            return (
              <div
                key={s.id}
                className="ring-node"
                style={{
                  position: "absolute",
                  width: `${nodeSize}px`,
                  height: `${nodeSize}px`,
                  borderRadius: "50%",
                  background: s.color,
                  transform: `rotate(${angle}deg) translateY(-180px)`,
                  boxShadow: isNodePlaying
                    ? `0 0 30px ${s.color}, 0 0 60px ${s.color}`
                    : `0 0 15px ${s.color}`,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.3s ease",
                  zIndex: isNodePlaying ? 20 : 1,
                }}
                onClick={() => handlePlaySnippet(s)}
                onMouseEnter={() => setHoveredNode(s.id)}
                onMouseLeave={() => setHoveredNode(null)}
                title={`${s.user}: ${s.description}`}
              >
                <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#000" }}>
                  {roleIcon(s.role)}
                </span>
                {hoveredNode === s.id && (
                  <div className="node-tooltip" style={{ top: "-40px", left: "50%", transform: "translateX(-50%)", opacity: 1 }}>
                    {s.description} — {s.user}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        {isPlaying && (
          <div className="progress-container" style={{ maxWidth: "400px", margin: "0 auto" }}>
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Empty state */}
        {snippets.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-secondary)" }}>
            <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>This ring is empty</p>
            <p>Record or upload a sound below to get started!</p>
          </div>
        )}

        {/* Add Your Sound */}
        <div style={{ marginTop: "3rem", borderTop: "1px solid var(--border-color)", paddingTop: "2rem" }}>
          <h2 style={{ textAlign: "center", marginBottom: "1.5rem" }}>Add Your Sound</h2>
          <RecordingComponent onUpload={handleNewSnippet} />
        </div>

        {/* Contributions list */}
        {snippets.length > 0 && (
          <div style={{ marginTop: "3rem" }}>
            <h3 style={{ marginBottom: "1rem" }}>
              Contributions ({snippets.length})
            </h3>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {snippets.slice().reverse().map((s) => {
                const isItemPlaying = playingSnippetId === s.id;
                return (
                  <div
                    key={s.id}
                    className="glass"
                    style={{
                      padding: "1rem 1.25rem",
                      borderRadius: "12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      border: `1px solid ${isItemPlaying ? s.color : `${s.color}33`}`,
                      transition: "all 0.3s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1 }}>
                      <button
                        className={`snippet-play-btn ${isItemPlaying ? "playing" : ""}`}
                        onClick={() => handlePlaySnippet(s)}
                        style={isItemPlaying ? { background: s.color } : {}}
                      >
                        {isItemPlaying ? "■" : "▶"}
                      </button>
                      <div>
                        <p style={{ fontWeight: "600", fontSize: "0.95rem" }}>{s.description}</p>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                          By {s.user}
                          {s.bpm && ` · ${s.bpm} BPM`}
                          {s.mood && ` · ${s.mood}`}
                        </p>
                      </div>
                    </div>
                    <span className={`tag tag-${s.role}`}>{s.role}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
