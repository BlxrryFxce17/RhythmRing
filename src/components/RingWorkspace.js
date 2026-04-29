"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import RecordingComponent from "./RecordingComponent";
import { getAudioContext, playSnippet } from "@/utils/audioUtils";

const PIXELS_PER_SECOND = 150; 
const TIMELINE_SECONDS = 12;

export default function RingWorkspace({ ring, onBack }) {
  const [snippets, setSnippets] = useState(() => {
    const base = ring.snippets && ring.snippets.length > 0 ? ring.snippets : [];
    return base.map((s, i) => ({
      ...s,
      startTime: s.startTime ?? i * 1.5,
      duration: s.duration ?? (s.role === "beat" ? 1.0 : 3.0),
      color: s.role === "beat" ? "#00f2ff" : s.role === "melody" ? "#7000ff" : s.role === "vocal" ? "#ff00c8" : "#39d353",
    }));
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false); // USE REF FOR SCHEDULING
  const [playingSnippetId, setPlayingSnippetId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  const progressTimerRef = useRef(null);
  const audioElementsRef = useRef([]);
  const timelineRef = useRef(null);
  const timersRef = useRef([]);

  useEffect(() => {
    return () => stopPlayback();
  }, []);

  const stopPlayback = () => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    setProgress(0);
    setCurrentTime(0);
    
    // Clear all scheduled sounds
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    
    audioElementsRef.current.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    audioElementsRef.current = [];
    setPlayingSnippetId(null);
  };

  const handleNewSnippet = useCallback((analysis) => {
    const newId = Date.now();
    const newSnippet = {
      id: newId,
      role: analysis.role || "texture",
      description: analysis.description || "Recorded Sound",
      user: "You",
      color: analysis.role === "beat" ? "#00f2ff" : analysis.role === "melody" ? "#7000ff" : "#ff00c8",
      audioUrl: analysis.audioUrl || null,
      startTime: currentTime > 0 ? currentTime : 0,
      duration: analysis.duration || 2.0, // Use the real duration from recording
    };

    // NO LONGER OVERWRITING DURATION HERE
    // The duration is now passed correctly from RecordingComponent
    setSnippets((prev) => [...prev, newSnippet]);
  }, [currentTime]);

  const handleDeleteSnippet = (id) => {
    setSnippets((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateStartTime = useCallback((id, newStartTime) => {
    setSnippets((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const clampedStart = Math.max(0, Math.min(newStartTime, TIMELINE_SECONDS - s.duration));
          return { ...s, startTime: clampedStart };
        }
        return s;
      })
    );
  }, []);

  const handlePlaySnippet = (snippet) => {
    if (snippet.audioUrl) {
      const audio = new Audio(snippet.audioUrl);
      setPlayingSnippetId(snippet.id);
      audio.onended = () => setPlayingSnippetId(null);
      audio.play().catch(() => setPlayingSnippetId(null));
    } else {
      const ctx = getAudioContext();
      playSnippet(ctx, snippet);
      setPlayingSnippetId(snippet.id);
      setTimeout(() => setPlayingSnippetId(null), 1000);
    }
  };

  const handlePlayAll = useCallback(() => {
    if (snippets.length === 0) return;
    if (isPlaying) {
      stopPlayback();
      return;
    }

    setIsPlaying(true);
    isPlayingRef.current = true;
    setProgress(0);
    setCurrentTime(0);

    const startTimestamp = Date.now();
    const totalDurationMs = TIMELINE_SECONDS * 1000;

    // Schedule each snippet
    snippets.forEach((s) => {
      const delay = s.startTime * 1000;
      const timer = setTimeout(() => {
        if (!isPlayingRef.current) return; // DON'T PLAY IF STOPPED
        
        if (s.audioUrl) {
          const audio = new Audio(s.audioUrl);
          audioElementsRef.current.push(audio);
          audio.play().catch(err => console.error("Playback error:", err));
          setPlayingSnippetId(s.id);
          setTimeout(() => { if (isPlayingRef.current) setPlayingSnippetId(null); }, s.duration * 1000);
        } else {
          const ctx = getAudioContext();
          playSnippet(ctx, s);
          setPlayingSnippetId(s.id);
          setTimeout(() => { if (isPlayingRef.current) setPlayingSnippetId(null); }, 1000);
        }
      }, delay);
      timersRef.current.push(timer);
    });

    // Progress bar update
    progressTimerRef.current = setInterval(() => {
      if (!isPlayingRef.current) {
        clearInterval(progressTimerRef.current);
        return;
      }
      const elapsed = Date.now() - startTimestamp;
      const pct = (elapsed / totalDurationMs) * 100;
      
      if (pct >= 100) {
        stopPlayback();
      } else {
        setProgress(pct);
        setCurrentTime(elapsed / 1000);
      }
    }, 16);

  }, [snippets, isPlaying]);

  return (
    <div className="fade-in">
      <button onClick={onBack} className="btn btn-secondary" style={{ marginBottom: "1rem" }}>
        ← Dashboard
      </button>

      <div className="glass" style={{ padding: "1.5rem", borderRadius: "24px" }}>
        <header style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "2rem" }}>{ring.name}</h1>
          <button 
            className={`btn ${isPlaying ? "btn-danger" : "btn-primary"}`} 
            onClick={handlePlayAll}
            style={{ marginTop: "1rem", padding: "0.8rem 3rem", fontSize: "1.1rem" }}
          >
            {isPlaying ? "⏹ STOP TRACK" : "▶ PLAY TRACK"}
          </button>
        </header>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <h3 style={{ fontSize: "0.8rem", opacity: 0.6 }}>ARRANGER</h3>
            <div style={{ fontFamily: "monospace", fontSize: "1.2rem", color: "#00f2ff" }}>
                {currentTime.toFixed(2)}s / {TIMELINE_SECONDS}s
            </div>
        </div>

        <div 
          style={{
            position: "relative",
            width: "100%",
            height: "320px",
            background: "#080a0d",
            borderRadius: "16px",
            border: "1px solid #1a1d23",
            overflowX: "auto",
            overflowY: "hidden"
          }}
        >
          <div 
            ref={timelineRef}
            style={{
              position: "relative",
              width: `${TIMELINE_SECONDS * PIXELS_PER_SECOND}px`,
              height: "100%",
              backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
              backgroundSize: `${PIXELS_PER_SECOND}px 100%`
            }}
          >
            {snippets.map((s, idx) => {
              const widthPx = s.duration * PIXELS_PER_SECOND;
              const leftPx = s.startTime * PIXELS_PER_SECOND;
              const isNodePlaying = playingSnippetId === s.id;

              return (
                <div
                  key={s.id}
                  style={{
                    position: "absolute",
                    left: `${leftPx}px`,
                    top: `${idx * 45 + 20}px`,
                    width: `${widthPx}px`,
                    height: "36px",
                    background: s.color,
                    borderRadius: "6px",
                    cursor: "grab",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 10px",
                    fontSize: "0.75rem",
                    color: "#000",
                    fontWeight: "bold",
                    zIndex: 5,
                    userSelect: "none",
                    border: "1px solid rgba(255,255,255,0.3)",
                    boxShadow: isNodePlaying ? `0 0 20px ${s.color}` : "none",
                    boxSizing: "border-box"
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const originalStartTime = s.startTime;
                    const onMouseMove = (moveE) => {
                      const deltaX = moveE.clientX - startX;
                      const deltaT = deltaX / PIXELS_PER_SECOND;
                      handleUpdateStartTime(s.id, originalStartTime + deltaT);
                    };
                    const onMouseUp = () => {
                      window.removeEventListener("mousemove", onMouseMove);
                      window.removeEventListener("mouseup", onMouseUp);
                    };
                    window.addEventListener("mousemove", onMouseMove);
                    window.addEventListener("mouseup", onMouseUp);
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.description}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteSnippet(s.id); }}
                    style={{ background: "rgba(0,0,0,0.2)", border: "none", fontWeight: "bold", cursor: "pointer" }}
                  >
                    ×
                  </button>
                </div>
              );
            })}

            {/* NEON BLUE PLAYHEAD */}
            {isPlaying && (
              <div style={{
                position: "absolute",
                left: `${(progress / 100) * TIMELINE_SECONDS * PIXELS_PER_SECOND}px`,
                top: 0,
                bottom: 0,
                width: "4px",
                background: "#00f2ff",
                boxShadow: "0 0 20px #00f2ff, 0 0 40px #00f2ff",
                zIndex: 10,
                pointerEvents: "none"
              }} />
            )}
          </div>
        </div>

        {/* TRACK LAYERS LIST */}
        <div style={{ marginTop: "2rem" }}>
          <h3 style={{ marginBottom: "1rem", fontSize: "1rem", opacity: 0.7 }}>TRACK LAYERS ({snippets.length})</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
            {snippets.map((s) => (
              <div key={s.id} className="glass" style={{ padding: "0.8rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `5px solid ${s.color}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                  <button onClick={() => handlePlaySnippet(s)} style={{ background: s.color, color: "#000", border: "none", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer" }}>▶</button>
                  <div>
                    <p style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{s.description}</p>
                    <p style={{ fontSize: "0.7rem", opacity: 0.6 }}>{s.duration.toFixed(2)}s @ {s.startTime.toFixed(2)}s</p>
                  </div>
                </div>
                <button onClick={() => handleDeleteSnippet(s.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>🗑️</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "2rem" }}>
          <RecordingComponent onUpload={handleNewSnippet} />
        </div>
      </div>
    </div>
  );
}
