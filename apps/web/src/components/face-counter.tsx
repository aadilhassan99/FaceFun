"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { createFaceDetector, type FaceDetection, type FaceDetectorInstance } from "@human-counter/vision";

type InputMode = "camera" | "image";
type FeatureMode = "scan" | "emojify";

const DETECTION_INTERVAL_MS = 80;
const EMOJIS = ["😎", "😍", "😂", "🤩", "🥸", "🤖", "👽"];

export function FaceCounter() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<FaceDetectorInstance | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastDetectionRef = useRef(0);
  const imageUrlRef = useRef<string | null>(null);

  const [feature, setFeature] = useState<FeatureMode>("scan");
  const [mode, setMode] = useState<InputMode>("camera");
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJIS[0]);
  const [cameraOn, setCameraOn] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [status, setStatus] = useState("Choose Face Scan or Emojify to get started.");
  const [error, setError] = useState<string | null>(null);
  const [loadingModel, setLoadingModel] = useState(false);
  const [imageReady, setImageReady] = useState(false);

  const getDetector = useCallback(async () => {
    if (detectorRef.current) return detectorRef.current;
    setLoadingModel(true);
    try {
      const detector = await createFaceDetector();
      detectorRef.current = detector;
      return detector;
    } finally {
      setLoadingModel(false);
    }
  }, []);

  const drawDetections = useCallback((detections: FaceDetection[], width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.clearRect(0, 0, width, height);
    const faces = detections.filter((detection) => Boolean(detection.boundingBox));

    for (const detection of faces) {
      const box = detection.boundingBox;
      if (!box) continue;
      if (feature === "scan") {
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = Math.max(3, Math.round(width / 240));
        ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
        ctx.shadowBlur = 2;
        ctx.strokeRect(box.originX, box.originY, box.width, box.height);
        ctx.shadowBlur = 0;
      } else {
        // Draw a selected emoji over each detected face, sized to cover the face.
        const fontSize = Math.max(24, Math.round(Math.min(box.width * 1.12, box.height * 1.12)));
        ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(selectedEmoji, box.originX + box.width / 2, box.originY + box.height / 2, box.width * 1.35);
      }
    }
    setFaceCount(faces.length);
  }, [feature, selectedEmoji]);

  const detectImage = useCallback(async () => {
    const image = imageRef.current;
    if (!image || !image.complete || !image.naturalWidth) return;
    setError(null);
    try {
      const detector = await getDetector();
      await detector.setOptions({ runningMode: "IMAGE" });
      const detections = detector.detect(image).detections;
      drawDetections(detections, image.naturalWidth, image.naturalHeight);
      setStatus(feature === "emojify" ? "Emoji applied to detected faces." : "Image scanned.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not detect faces in this image.");
    }
  }, [drawDetections, feature, getDetector]);

  const stopCamera = useCallback(() => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setStatus("Requesting camera access…");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not available. Use HTTPS or localhost in a supported browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview is not ready.");
      video.srcObject = stream;
      await video.play();
      const detector = await getDetector();
      await detector.setOptions({ runningMode: "VIDEO" });
      setCameraOn(true);
      setStatus(feature === "emojify" ? "Camera is live. Your selected emoji follows each detected face." : "Camera is live. Faces are detected on this device.");
    } catch (cause) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraOn(false);
      setError(cause instanceof Error ? cause.message : "Could not start the camera. Check browser permissions.");
      setStatus("Camera could not be started.");
    }
  }, [feature, getDetector]);

  useEffect(() => {
    if (!cameraOn || mode !== "camera") return;
    let active = true;
    const tick = (now: number) => {
      if (!active) return;
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (video && detector && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && now - lastDetectionRef.current >= DETECTION_INTERVAL_MS) {
        lastDetectionRef.current = now;
        try {
          const detections = detector.detectForVideo(video, now).detections;
          drawDetections(detections, video.videoWidth, video.videoHeight);
        } catch {
          // A transient frame can be unavailable while the camera starts or changes state.
        }
      }
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    };
  }, [cameraOn, mode, drawDetections]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      detectorRef.current?.close();
    };
  }, []);

  // Redraw an uploaded image when the user changes feature or emoji.
  useEffect(() => {
    if (mode === "image" && imageReady) void detectImage();
  }, [feature, selectedEmoji, imageReady, mode, detectImage]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const changeFeature = (nextFeature: FeatureMode) => {
    if (nextFeature === feature) return;
    setFeature(nextFeature);
    setError(null);
    setStatus(nextFeature === "emojify" ? "Choose an emoji, then use your camera or upload a photo." : "Choose camera or upload an image to scan faces.");
    clearCanvas();
    if (mode === "image" && imageReady) window.setTimeout(() => void detectImage(), 0);
  };

  const changeMode = (nextMode: InputMode) => {
    if (nextMode === mode) return;
    stopCamera();
    setMode(nextMode);
    setError(null);
    setFaceCount(0);
    setStatus(nextMode === "camera" ? "Start your camera to detect faces." : "Upload an image to detect faces.");
    setImageReady(false);
    clearCanvas();
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose a valid image file.");
      return;
    }
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    imageUrlRef.current = URL.createObjectURL(file);
    setImageReady(false);
    setError(null);
    setFaceCount(0);
    setStatus("Loading image…");
    if (imageRef.current) imageRef.current.src = imageUrlRef.current;
    event.target.value = "";
  };

  const onImageLoaded = () => {
    setImageReady(true);
    void detectImage();
  };

  const scanLabel = loadingModel ? "Loading detector…" : feature === "emojify" ? "Apply emoji again" : "Scan image";

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Human Counter home">
          <span className="brand-mark" aria-hidden="true"><ScanIcon /></span>
          <span>human<span className="brand-light">counter</span></span>
        </a>
        <span className="privacy-note"><span className="privacy-dot" /> Runs in your browser</span>
      </header>

      <section className="intro">
        <div className="eyebrow"><span className="eyebrow-line" /> FACE TOOLS, MADE SIMPLE</div>
        <h1>Scan faces.<br /><span>Add some fun.</span></h1>
        <p>Detect faces with green boxes or cover them with a playful emoji. Your photos stay on this device.</p>
      </section>

      <div className="feature-switch" role="tablist" aria-label="Choose a face tool">
        <button className={`feature-button ${feature === "scan" ? "active" : ""}`} role="tab" aria-selected={feature === "scan"} onClick={() => changeFeature("scan")}><ScanIcon /> Face Scan <small>Count detected faces</small></button>
        <button className={`feature-button ${feature === "emojify" ? "active" : ""}`} role="tab" aria-selected={feature === "emojify"} onClick={() => changeFeature("emojify")}><span className="feature-emoji">😎</span> Emojify <small>Cover faces with emoji</small></button>
      </div>

      {feature === "emojify" && (
        <section className="emoji-picker" aria-label="Choose an emoji">
          <div><strong>Pick your emoji</strong><span>It will be applied to every detected face.</span></div>
          <div className="emoji-options">
            {EMOJIS.map((emoji) => <button key={emoji} className={`emoji-option ${selectedEmoji === emoji ? "selected" : ""}`} onClick={() => setSelectedEmoji(emoji)} aria-label={`Use ${emoji}`} aria-pressed={selectedEmoji === emoji}>{emoji}</button>)}
          </div>
        </section>
      )}

      <section className="workspace" aria-label={feature === "scan" ? "Face scanner" : "Emojify tool"}>
        <div className="workspace-toolbar">
          <div className="mode-switch" role="tablist" aria-label="Input source">
            <button className={`mode-button ${mode === "camera" ? "active" : ""}`} role="tab" aria-selected={mode === "camera"} onClick={() => changeMode("camera")}><CameraIcon /> Webcam</button>
            <button className={`mode-button ${mode === "image" ? "active" : ""}`} role="tab" aria-selected={mode === "image"} onClick={() => changeMode("image")}><ImageIcon /> Upload image</button>
          </div>
          <div className="count-pill"><span className="count-indicator" /> <strong>{faceCount}</strong> {faceCount === 1 ? "face" : "faces"} detected</div>
        </div>

        <div className={`stage ${mode === "image" && imageReady ? "stage-image" : ""}`}>
          {mode === "camera" ? (
            <>
              <video ref={videoRef} className={`source-video ${cameraOn ? "visible" : "hidden"}`} playsInline muted aria-label="Live webcam preview" />
              <canvas ref={canvasRef} className={`detection-canvas ${cameraOn ? "visible" : "hidden"}`} aria-label={feature === "scan" ? "Face detection boxes" : "Emoji face overlay"} />
              {!cameraOn && (
                <div className="empty-state">
                  <div className="empty-icon">{feature === "scan" ? <CameraIcon /> : <span className="big-emoji">{selectedEmoji}</span>}</div>
                  <h2>{feature === "scan" ? "Your camera, your space." : "Ready for your close-up?"}</h2>
                  <p>{feature === "scan" ? "Allow camera access to start live face detection." : "Choose an emoji above, then start the camera to apply it to detected faces."}</p>
                  <button className="primary-button" onClick={() => void startCamera()} disabled={loadingModel}><CameraIcon /> {loadingModel ? "Loading detector…" : "Enable camera"}</button>
                </div>
              )}
              {cameraOn && <div className="live-badge"><span className="live-dot" /> LIVE</div>}
            </>
          ) : (
            <>
              <img ref={imageRef} className={`source-image ${imageReady ? "visible" : "hidden"}`} alt="Uploaded image being processed" onLoad={onImageLoaded} onError={() => { setError("This image could not be opened. Try another file."); setImageReady(false); }} />
              <canvas ref={canvasRef} className={`detection-canvas ${imageReady ? "visible" : "hidden"}`} aria-label={feature === "scan" ? "Detected face boxes" : "Emoji face overlay"} />
              {!imageReady && (
                <div className="empty-state">
                  <div className="empty-icon">{feature === "scan" ? <UploadIcon /> : <span className="big-emoji">{selectedEmoji}</span>}</div>
                  <h2>{feature === "scan" ? "Drop in a photo." : "Give your photo a new look."}</h2>
                  <p>Choose an image and we’ll {feature === "scan" ? "mark each detected face." : `cover each detected face with ${selectedEmoji}.`}</p>
                  <label className="primary-button file-button"><UploadIcon /> Choose image<input type="file" accept="image/*" onChange={handleImageUpload} /></label>
                </div>
              )}
            </>
          )}
        </div>

        <div className="workspace-footer">
          <div className="status-line"><span className={`status-dot ${error ? "status-error" : ""}`} /> <span>{error ?? (loadingModel ? "Preparing face detector…" : status)}</span></div>
          {mode === "camera" ? (
            <button className="secondary-button" onClick={() => cameraOn ? stopCamera() : void startCamera()} disabled={loadingModel && !cameraOn}>{cameraOn ? "Stop camera" : "Start camera"}</button>
          ) : (
            <div className="image-actions">
              {imageReady && <button className="secondary-button" onClick={() => void detectImage()} disabled={loadingModel}>{scanLabel}</button>}
              <label className="secondary-button file-button">{imageReady ? "Change image" : "Browse files"}<input type="file" accept="image/*" onChange={handleImageUpload} /></label>
            </div>
          )}
        </div>
      </section>

      <div className="bottom-notes">
        <div><span className="note-icon"><LockIcon /></span><span><strong>Private by design</strong><small>Your images stay on this device.</small></span></div>
        <div><span className="note-icon green-note">{feature === "scan" ? <SquareIcon /> : <span>✨</span>}</span><span><strong>{feature === "scan" ? "Green means detected" : "Emoji every face"}</strong><small>{feature === "scan" ? "Each box marks one detected face." : "The selected emoji tracks detected faces."}</small></span></div>
      </div>
      <footer>Made for quick, simple face tools. No account needed.</footer>
    </main>
  );
}

function ScanIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18a5.5 5.5 0 0 1 11 0"/></svg>; }
function CameraIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="15" rx="2"/><path d="m8 6 1.5-3h5L16 6"/><circle cx="12" cy="13" r="4"/></svg>; }
function ImageIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>; }
function UploadIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>; }
function LockIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></svg>; }
function SquareIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>; }
