
import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, Camera, Target, Play, Square } from 'lucide-react';
import { translations } from '../utils/translations';
import { Language } from '../types';
import { trackByColor, trackBrightestPoint, calibrateColorFromClick, ColorRange, COLOR_PRESETS, ROI, TrackingPoint } from '../utils/tracking';

interface VbtTestProps {
  lang: Language;
  onBack: () => void;
  onShowReport?: (data: VbtSessionData) => void;
}

export interface RepData {
  peakVelocity: number;
  avgVelocity: number;
  duration: number;
  timestamp: number;
}

export interface VbtSessionData {
  athleteName: string;
  date: string;
  reps: RepData[];
}

const CONFIG = {
    targetFPS: 60,
    silenceThreshold: 3.5,
    movementThreshold: 0.003,
    minBlobSize: 50
};

const VbtTest: React.FC<VbtTestProps> = ({ lang, onBack, onShowReport }) => {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [phase, setPhase] = useState<'setup' | 'calibrate' | 'tracking'>('setup');
  const [velocity, setVelocity] = useState(0.00);
  const [peakVelocity, setPeakVelocity] = useState(0.00);
  const [repCount, setRepCount] = useState(0);
  const [status, setStatus] = useState(t.vbtStart);
  const [trackingMode] = useState<'color' | 'brightness'>('color');
  const [colorRange, setColorRange] = useState<ColorRange>(COLOR_PRESETS.white);
  const [trackingConfidence, setTrackingConfidence] = useState(0);

  const stateRef = useRef({
      isRecording: false,
      lastMovementTime: 0,
      positions: [] as {y: number, t: number}[],
      lastTime: 0,
      allReps: [] as RepData[],
      currentRepVelocities: [] as number[],
      currentRepStartTime: 0,
      currentRepPeak: 0,
      inRep: false,
      sessionStartTime: 0,
      lastTrackPoint: null as TrackingPoint | null
  });

  const audioCtxRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
      }
  };

  const beep = () => {
      if (!audioCtxRef.current) return;
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + 0.3);
  };

  const startCamera = async () => {
      try {
          initAudio();
          const stream = await navigator.mediaDevices.getUserMedia({
              video: {
                  facingMode: 'environment',
                  width: { ideal: 1920 },
                  height: { ideal: 1080 },
                  frameRate: { ideal: 60, max: 120 }
              },
              audio: false
          });

          if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.onloadedmetadata = () => {
                  if (canvasRef.current && videoRef.current) {
                      canvasRef.current.width = videoRef.current.videoWidth;
                      canvasRef.current.height = videoRef.current.videoHeight;
                      setPhase('calibrate');
                      setStatus('Tap marker to calibrate');
                  }
              };
          }
      } catch (err) {
          console.error("Camera error:", err);
          alert("Could not start camera. Please ensure permissions are granted.");
      }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (phase !== 'calibrate' || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const calibratedColor = calibrateColorFromClick(ctx, x, y, 15);
      setColorRange(calibratedColor);

      startTracking();
  };

  const startTracking = () => {
      setPhase('tracking');
      setStatus(t.vbtStatusReady);
      stateRef.current.isRecording = true;
      stateRef.current.lastMovementTime = Date.now() / 1000;
      stateRef.current.sessionStartTime = Date.now();
      requestAnimationFrame(processFrame);
  };

  const processFrame = (timestamp: number) => {
      if (!stateRef.current.isRecording || !canvasRef.current || !videoRef.current) return;

      const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      const roi: ROI = {
          x: 0,
          y: 0,
          w: canvasRef.current.width,
          h: canvasRef.current.height
      };

      let trackPoint: TrackingPoint | null = null;

      if (trackingMode === 'color') {
          trackPoint = trackByColor(ctx, roi, colorRange, CONFIG.minBlobSize);
      } else {
          trackPoint = trackBrightestPoint(ctx, roi, 'brightness', 200);
      }

      if (trackPoint && trackPoint.confidence > 0.3) {
          stateRef.current.lastTrackPoint = trackPoint;
          setTrackingConfidence(trackPoint.confidence);
          updatePhysics(trackPoint.y, timestamp);

          const x = trackPoint.x * canvasRef.current.width;
          const y = trackPoint.y * canvasRef.current.height;

          const size = 12 + (trackPoint.confidence * 8);
          ctx.strokeStyle = trackPoint.confidence > 0.7 ? '#10b981' : '#ef4444';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x - 20, y);
          ctx.lineTo(x + 20, y);
          ctx.moveTo(x, y - 20);
          ctx.lineTo(x, y + 20);
          ctx.stroke();
      } else {
          setTrackingConfidence(0);
      }

      requestAnimationFrame(processFrame);
  };

  const updatePhysics = (currentY: number, timestamp: number) => {
      const timeInSeconds = timestamp / 1000;
      const state = stateRef.current;

      state.positions.push({ y: currentY, t: timeInSeconds });
      if (state.positions.length > 10) state.positions.shift();

      if (state.positions.length > 5) {
          const prev = state.positions[0];
          const curr = state.positions[state.positions.length - 1];
          const dy = Math.abs(curr.y - prev.y);
          const dt = curr.t - prev.t;

          if (dt > 0) {
              const vel = (dy / dt) * 2.5;

              if (dy > CONFIG.movementThreshold) {
                  if (!state.inRep) {
                      state.inRep = true;
                      state.currentRepStartTime = timeInSeconds;
                      state.currentRepVelocities = [];
                      state.currentRepPeak = 0;
                  }

                  state.currentRepVelocities.push(vel);
                  if (vel > state.currentRepPeak) {
                      state.currentRepPeak = vel;
                      setPeakVelocity(vel);
                  }

                  state.lastMovementTime = timeInSeconds;
                  setVelocity(vel);
                  setStatus(t.vbtStatusMeasuring);
              } else {
                  if (state.inRep && timeInSeconds - state.lastMovementTime > 0.5) {
                      finishRep(timeInSeconds);
                  }
              }
          }
      }

      if (timeInSeconds - state.lastMovementTime > CONFIG.silenceThreshold && state.isRecording && state.allReps.length > 0) {
           finishSet();
      }
  };

  const finishRep = (timeInSeconds: number) => {
      const state = stateRef.current;
      if (!state.inRep || state.currentRepVelocities.length === 0) return;

      const repDuration = timeInSeconds - state.currentRepStartTime;
      const avgVel = state.currentRepVelocities.reduce((sum, v) => sum + v, 0) / state.currentRepVelocities.length;

      const repData: RepData = {
          peakVelocity: state.currentRepPeak,
          avgVelocity: avgVel,
          duration: repDuration,
          timestamp: Date.now()
      };

      state.allReps.push(repData);
      setRepCount(state.allReps.length);

      state.inRep = false;
      state.currentRepVelocities = [];
      state.currentRepPeak = 0;

      beep();
  };

  const finishSet = () => {
      stateRef.current.isRecording = false;
      setStatus(t.vbtStatusDone);
      beep();

      if (stateRef.current.allReps.length > 0 && onShowReport) {
          const sessionData: VbtSessionData = {
              athleteName: 'Athlete',
              date: new Date().toISOString(),
              reps: stateRef.current.allReps
          };
          onShowReport(sessionData);
      }
  };

  const stopSession = () => {
      finishSet();
      if (videoRef.current && videoRef.current.srcObject) {
          const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach(t => t.stop());
      }
  };

  useEffect(() => {
      return () => {
          stateRef.current.isRecording = false;
          if (videoRef.current && videoRef.current.srcObject) {
              const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
              tracks.forEach(t => t.stop());
          }
      };
  }, []);

  useEffect(() => {
      window.scrollTo(0, 1);
      setTimeout(() => window.scrollTo(0, 1), 100);
  }, []);

  return (
    <div className="fixed inset-0 bg-black text-white z-50 flex flex-col font-sans" style={{ height: '100dvh', minHeight: '100dvh' }}>

        <div className="absolute inset-0 z-0" style={{ height: '100%' }}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
            />
            <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="absolute top-0 left-0 w-full h-full object-cover z-10 opacity-90"
                style={{ cursor: phase === 'calibrate' ? 'crosshair' : 'default' }}
            />
        </div>

        <div className="relative z-20 flex flex-col h-full pointer-events-none">

            <div className="p-3 flex justify-between items-center pointer-events-auto bg-gradient-to-b from-black/60 to-transparent">
                <button
                    onClick={onBack}
                    className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20"
                >
                    <ArrowLeft size={18} />
                </button>

                <div className="bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-2">
                    <Camera size={12} className="text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">VBT</span>
                </div>

                <div className="w-10 h-10"></div>
            </div>

            {phase === 'setup' && (
                <div className="flex-1 flex items-center justify-center px-6">
                    <div className="text-center">
                        <Target size={64} className="mx-auto mb-4 text-cyan-400" />
                        <h2 className="text-xl font-black uppercase mb-3 tracking-tight">Setup</h2>
                        <p className="text-slate-300 text-sm mb-6 max-w-xs mx-auto leading-relaxed">
                            {t.vbtInstruction}
                        </p>
                        <button
                            onClick={startCamera}
                            className="bg-cyan-500 hover:bg-cyan-400 text-black px-6 py-3 rounded-full font-bold uppercase tracking-wide flex items-center gap-2 mx-auto shadow-lg pointer-events-auto transition-transform active:scale-95"
                        >
                            <Play fill="currentColor" size={18} />
                            {t.vbtStart}
                        </button>
                    </div>
                </div>
            )}

            {phase === 'calibrate' && (
                <div className="flex-1 flex flex-col justify-between">
                    <div className="flex-1 flex items-center justify-center">
                        <div className="bg-black/70 backdrop-blur-md px-6 py-4 rounded-2xl border border-cyan-400/30 text-center">
                            <Target size={32} className="mx-auto mb-2 text-cyan-400 animate-pulse" />
                            <p className="text-sm font-bold text-cyan-400">Tap bright marker/tape</p>
                            <p className="text-xs text-slate-400 mt-1">White, green, or orange tape</p>
                        </div>
                    </div>

                    <div className="p-4 flex gap-2 justify-center pointer-events-auto bg-gradient-to-t from-black/60 to-transparent">
                        {Object.entries(COLOR_PRESETS).map(([name, preset]) => (
                            <button
                                key={name}
                                onClick={() => {
                                    setColorRange(preset);
                                    startTracking();
                                }}
                                className="px-3 py-2 text-xs font-bold rounded-lg bg-black/60 border border-white/20 hover:border-cyan-400 capitalize"
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {phase === 'tracking' && (
                <div className="flex-1 flex flex-col justify-end pb-4">
                    <div className="p-3 bg-gradient-to-t from-black/80 via-black/60 to-transparent">

                        <div className="flex justify-between items-center mb-3 gap-2 px-2">
                            <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                                <span className="text-xs text-slate-400">Reps:</span>
                                <span className="text-lg font-black text-cyan-400 ml-2">{repCount}</span>
                            </div>
                            <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                                <span className="text-xs text-slate-400">Peak:</span>
                                <span className="text-lg font-black text-green-400 ml-2">{peakVelocity.toFixed(2)}</span>
                            </div>
                            <div className={`bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border ${trackingConfidence > 0.7 ? 'border-green-500' : 'border-red-500'}`}>
                                <span className="text-xs text-slate-400">Track:</span>
                                <span className={`text-xs font-bold ml-2 ${trackingConfidence > 0.7 ? 'text-green-400' : 'text-red-400'}`}>
                                    {(trackingConfidence * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>

                        <div className="text-center mb-3">
                            <div className="text-6xl font-black font-mono tabular-nums text-yellow-400 drop-shadow-lg">
                                {velocity.toFixed(2)}
                                <span className="text-base text-yellow-500/80 font-bold ml-1">m/s</span>
                            </div>
                            <div className={`text-xs font-bold uppercase tracking-wide mt-1 ${status === t.vbtStatusMeasuring ? 'text-green-400' : 'text-slate-400'}`}>
                                {status}
                            </div>
                        </div>

                        <button
                            onClick={stopSession}
                            className="w-full bg-red-500/20 border-2 border-red-500 hover:bg-red-500/30 text-red-500 py-3 rounded-xl font-bold uppercase tracking-wide pointer-events-auto flex items-center justify-center gap-2"
                        >
                            <Square size={16} />
                            Stop
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default VbtTest;
