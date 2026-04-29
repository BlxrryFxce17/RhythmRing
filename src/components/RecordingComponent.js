"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export default function RecordingComponent({ onUpload }) {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    };
  }, []);

  // Toggle recording: click to start, click to stop
  const toggleRecording = useCallback(async () => {
    setError(null);

    if (isRecording) {
      // STOP recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      setRecordingTime(0);
      if (timerRef.current) clearInterval(timerRef.current);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }

    // START recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const endTime = Date.now();
        const duration = (endTime - startTimeRef.current) / 1000;
        const chunks = audioChunksRef.current;
        if (chunks.length === 0) {
          setError("No audio data captured. Try recording for longer.");
          return;
        }

        const actualMime = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(chunks, { type: actualMime });

        if (audioBlob.size < 1000) {
          setError("Recording too short. Please record for at least 1 second.");
          return;
        }

        const ext = actualMime.includes("webm") ? "webm" : "ogg";
        const file = new File([audioBlob], `recording.${ext}`, { type: actualMime });
        audioChunksRef.current = [];

        // Create an audio URL from the blob so we can play back the REAL recording
        const audioUrl = URL.createObjectURL(audioBlob);
        await handleUpload(file, audioUrl, duration);
      };

      recorder.start(250);
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone error:", err);
      setError("Microphone access denied. Please allow mic permission and try again.");
    }
  }, [isRecording]);

  const handleUpload = async (file, audioUrl = null, recordedDuration = null) => {
    setLoading(true);
    setError(null);

    // If it's a file upload (not recording), create audioUrl from the file
    if (!audioUrl && file) {
      audioUrl = URL.createObjectURL(file);
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        if (data.error) {
          setError(data.error);
          if (audioUrl) URL.revokeObjectURL(audioUrl);
        } else {
          // Pass the real audio URL along with the analysis and duration
          onUpload({ ...data, audioUrl, duration: recordedDuration });
        }
      } else {
        setError(data.error || `Analysis failed (${res.status})`);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Upload failed. Check your connection.");
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    } finally {
      setLoading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      handleUpload(file);
    } else if (file) {
      setError("Please drop an audio file (mp3, wav, etc.).");
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{ padding: "1rem" }}>
      {/* Error display */}
      {error && (
        <div
          style={{
            background: "rgba(255, 77, 77, 0.1)",
            border: "1px solid var(--danger)",
            borderRadius: "12px",
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            fontSize: "0.85rem",
            color: "var(--danger)",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Recording Button */}
      <div style={{ textAlign: "center" }}>
        <div
          className={`pulse ${isRecording ? "recording" : ""}`}
          onClick={!loading ? toggleRecording : undefined}
          style={{
            margin: "0 auto",
            backgroundColor: isRecording ? "var(--danger)" : "var(--accent-tertiary)",
            userSelect: "none",
            opacity: loading ? 0.5 : 1,
            pointerEvents: loading ? "none" : "auto",
          }}
        >
          {loading ? (
            <span style={{ fontSize: "1.2rem" }}>⏳</span>
          ) : (
            <span style={{ fontSize: "1.5rem" }}>{isRecording ? "⏹" : "🎤"}</span>
          )}
        </div>

        {isRecording && (
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "1.5rem",
              fontWeight: "700",
              fontFamily: "monospace",
              color: "var(--danger)",
            }}
          >
            {formatTime(recordingTime)}
          </p>
        )}

        <p
          style={{
            marginTop: "0.5rem",
            color: "var(--text-secondary)",
            fontWeight: "500",
            fontSize: "0.9rem",
          }}
        >
          {loading
            ? "Analyzing with Gemini AI..."
            : isRecording
            ? "Recording... Click to stop"
            : "Click to start recording"}
        </p>
      </div>

      {isRecording && (
        <div className="waveform-container" style={{ marginTop: "0.5rem" }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="waveform-bar" />
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1.5rem 0" }}>
        <div style={{ flex: 1, height: "1px", background: "var(--border-color)" }} />
        <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>or</span>
        <div style={{ flex: 1, height: "1px", background: "var(--border-color)" }} />
      </div>

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
