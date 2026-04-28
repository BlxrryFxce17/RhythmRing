"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export default function RecordingComponent({ onUpload }) {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Cleanup on unmount — stop any active streams
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([audioBlob], "recording.webm", { type: "audio/webm" });
        audioChunksRef.current = []; // free memory
        await handleUpload(file);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
      alert("Please allow microphone access to record sounds.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  }, [isRecording]);

  const handleUpload = async (file) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        onUpload(data);
      } else {
        console.error("Analysis failed:", data.error);
        alert("Analysis failed. Please try again.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so same file can be picked again
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      handleUpload(file);
    } else if (file) {
      alert("Please drop an audio file (mp3, wav, etc.).");
    }
  };

  return (
    <div style={{ padding: "1rem" }}>
      {/* Recording Button */}
      <div style={{ textAlign: "center" }}>
        <div
          className={`pulse ${isRecording ? "recording" : ""}`}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          style={{
            margin: "0 auto",
            backgroundColor: isRecording ? "var(--danger)" : "var(--accent-tertiary)",
            userSelect: "none",
          }}
        >
          {loading ? (
            <span style={{ fontSize: "1.2rem" }}>⏳</span>
          ) : (
            <span style={{ fontSize: "1.5rem" }}>{isRecording ? "⏹" : "🎤"}</span>
          )}
        </div>
        <p style={{ marginTop: "1rem", color: "var(--text-secondary)", fontWeight: "500", fontSize: "0.9rem" }}>
          {loading
            ? "Analyzing with Gemini AI..."
            : isRecording
            ? "Recording... Release to analyze"
            : "Hold to record a sound"}
        </p>
      </div>

      {/* Waveform visualizer during recording */}
      {isRecording && (
        <div className="waveform-container" style={{ marginTop: "0.5rem" }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="waveform-bar" />
          ))}
        </div>
      )}

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1.5rem 0" }}>
        <div style={{ flex: 1, height: "1px", background: "var(--border-color)" }} />
        <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>or</span>
        <div style={{ flex: 1, height: "1px", background: "var(--border-color)" }} />
      </div>

      {/* File Upload Drop Zone */}
      <div
        className={`upload-zone ${dragOver ? "drag-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="upload-icon">📁</div>
        <p style={{ fontWeight: "600", color: "var(--text-primary)" }}>
          Drop an audio file here or click to browse
        </p>
        <p>.mp3, .wav, .ogg, .webm supported</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          style={{ display: "none" }}
          onChange={handleFileInput}
        />
      </div>
    </div>
  );
}
