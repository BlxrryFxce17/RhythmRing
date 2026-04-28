"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import RecordingComponent from "./RecordingComponent";
import { getAudioContext, playSnippet, playAllSnippets } from "@/utils/audioUtils";

export default function RingWorkspace({ ring, onBack }) {
  const [snippets, setSnippets] = useState(() => {
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
  const activeStopRef = useRef(null);
  // Track all real audio elements so we can stop them
  const audioElementsRef = useRef([]);

  // Cleanup timers and audio on unmount
  useEffect(() => {
    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (activeStopRef.current) {
        activeStopRef.current();
        activeStopRef.current = null;
      }
      // Stop and revoke all audio elements
      audioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      audioElementsRef.current = [];
      // Revoke any blob URLs
      snippets.forEach((s) => {
        if (s.audioUrl && s.audioUrl.startsWith("blob:")) {
          URL.revokeObjectURL(s.audioUrl);
        }
      });
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
      // Store the real audio URL from the recording
      audioUrl: analysis.audioUrl || null,
    };
    setSnippets((prev) => [...prev, newSnippet]);
  }, []);

  // Play a single snippet — use real audio if available, else synthesize
  const handlePlaySnippet = useCallback((snippet) => {
    setPlayingSnippetId(snippet.id);

    if (snippet.audioUrl) {
      // Play the REAL recorded audio
      const audio = new Audio(snippet.audioUrl);
      audioElementsRef.current.push(audio);

      audio.onended = () => {
        setPlayingSnippetId(null);
        audioElementsRef.current = audioElementsRef.current.filter((a) => a !== audio);
      };
      audio.onerror = () => {
        setPlayingSnippetId(null);
        audioElementsRef.current = audioElementsRef.current.filter((a) => a !== audio);
      };
      audio.play().catch(() => setPlayingSnippetId(null));
    } else {
      // Fallback to synthesis for example/demo snippets
      const ctx = getAudioContext();
      if (activeStopRef.current) activeStopRef.current();

      const { duration, stop } = playSnippet(ctx, snippet);
      activeStopRef.current = stop;

      setTimeout(() => {
        setPlayingSnippetId(null);
        if (activeStopRef.current === stop) activeStopRef.current = null;
      }, duration * 1000 + 50);
    }
  }, []);

  // Play all snippets
  const handlePlayAll = useCallback(() => {
    if (snippets.length === 0) return;

    if (isPlaying) {
      // Stop everything
      setIsPlaying(false);
      setProgress(0);
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      // Stop real audio elements
      audioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      audioElementsRef.current = [];
      // Stop synthesized audio
      if (activeStopRef.current) {
        activeStopRef.current();
        activeStopRef.current = null;
      }
      return;
    }

    setIsPlaying(true);
    setProgress(0);

    // Separate real-audio and synth-only snippets
    const realAudioSnippets = snippets.filter((s) => s.audioUrl);
    const synthSnippets = snippets.filter((s) => !s.audioUrl);

    let maxDuration = 0;

    // Play real audio snippets with staggered timing
    realAudioSnippets.forEach((s, i) => {
      const delay = i * 500; // 500ms apart
      setTimeout(() => {
        const audio = new Audio(s.audioUrl);
        audioElementsRef.current.push(audio);
        audio.onended = () => {
          audioElementsRef.current = audioElementsRef.current.filter((a) => a !== audio);
        };
        audio.play().catch(() => {});
      }, delay);
      // Estimate 3s per real audio clip
      maxDuration = Math.max(maxDuration, (delay + 3000) / 1000);
    });

    // Play synthesized snippets
    if (synthSnippets.length > 0) {
      const ctx = getAudioContext();
      if (activeStopRef.current) activeStopRef.current();
      const { duration: synthDuration, stop } = playAllSnippets(ctx, synthSnippets);
      activeStopRef.current = stop;
      maxDuration = Math.max(maxDuration, synthDuration);
    }

    // Ensure minimum duration for progress bar
    maxDuration = Math.max(maxDuration, 1);

    // Animate progress bar
    const startTime = Date.now();
    const durationMs = maxDuration * 1000;
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
      if (activeStopRef.current) {
        activeStopRef.current();
        activeStopRef.current = null;
      }
    }, durationMs + 200);
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

            <button
              className={`btn ${isPlaying ? "btn-danger" : "btn-primary"}`}
              style={{ padding: "0.5rem 1.25rem" }}
              onClick={handlePlayAll}
              disabled={snippets.length === 0}
            >
              {isPlaying ? "■ Stop" : "▶ Play Track"}
            </button>

            {isPlaying && (
              <div className="waveform-container" style={{ marginTop: "0.5rem" }}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="waveform-bar" />
                ))}
              </div>
            )}
          </div>

          {/* Sound Nodes on the Ring */}
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
                        <p style={{ fontWeight: "600", fontSize: "0.95rem" }}>
                          {s.description}
                          {s.audioUrl && (
                            <span style={{ fontSize: "0.7rem", marginLeft: "0.5rem", opacity: 0.6 }}>
                              🔊 real audio
                            </span>
                          )}
                        </p>
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
