
import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, Camera, Settings2, Play, Activity } from 'lucide-react';
import { translations } from '../utils/translations';
import { Language } from '../types';

interface VbtTestProps {
  lang: Language;
  onBack: () => void;
}

const CONFIG = {
    targetFPS: 60,
    silenceThreshold: 4.5, // seconds
    movementThreshold: 0.003, // Sensitivity (0.0 - 1.0)
    tapeBrightness: 200, // 0-255
    overlaySize: 250 // px
};

const VbtTest: React.FC<VbtTestProps> = ({ lang, onBack }) => {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [velocity, setVelocity] = useState(0.00);
  const [status, setStatus] = useState(t.vbtStart);
  const [mode, setMode] = useState<'overlay' | 'auto'>('overlay');
  
  // State refs for animation loop
  const stateRef = useRef({
      isRecording: false,
      lastMovementTime: 0,
      positions: [] as {y: number, t: number}[],
      lastTime: 0
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
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
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
                      
                      setIsRecording(true);
                      setStatus(t.vbtStatusReady);
                      
                      stateRef.current.isRecording = true;
                      stateRef.current.lastMovementTime = Date.now() / 1000;
                      
                      requestAnimationFrame(processFrame);
                  }
              };
          }
      } catch (err) {
          console.error("Camera error:", err);
          alert("Could not start camera. Please ensure permissions are granted.");
      }
  };

  const processFrame = (timestamp: number) => {
      if (!stateRef.current.isRecording || !canvasRef.current || !videoRef.current) return;
      
      const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // 1. Draw video frame
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      // 2. Define ROI (Region of Interest)
      let roi = { x: 0, y: 0, w: canvasRef.current.width, h: canvasRef.current.height };

      if (mode === 'overlay') {
          // Scale overlay box to canvas dimensions
          // This ensures the logic works regardless of screen size scaling
          // We assume the visual overlay box is centered on screen.
          // For simplicity in this engine, we take a center crop of the video feed matching CONFIG size ratio
          const scaleX = canvasRef.current.width / window.innerWidth;
          const scaleY = canvasRef.current.height / window.innerHeight;
          // Use the larger scale to ensure coverage or just fix it to a pixel area
          // Let's define ROI as center 30% of the screen for robust detection in box mode
          const boxSize = Math.min(canvasRef.current.width, canvasRef.current.height) * 0.4;
          
          roi = {
              x: (canvasRef.current.width - boxSize) / 2,
              y: (canvasRef.current.height - boxSize) / 2,
              w: boxSize,
              h: boxSize
          };
          
          // Debug draw (optional, usually handled by UI overlay)
          // ctx.strokeStyle = '#00FF00';
          // ctx.lineWidth = 2;
          // ctx.strokeRect(roi.x, roi.y, roi.w, roi.h);
      }

      // 3. Image Processing
      const yPos = findBrightestCentroid(ctx, roi);

      // 4. Physics Engine
      if (yPos !== null) {
          updatePhysics(yPos, timestamp);
          
          // Visual feedback dot
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(roi.x + roi.w/2, yPos * canvasRef.current.height, 6, 0, Math.PI * 2);
          ctx.fill();
      }

      requestAnimationFrame(processFrame);
  };

  const findBrightestCentroid = (ctx: CanvasRenderingContext2D, roi: {x: number, y: number, w: number, h: number}) => {
      const imgData = ctx.getImageData(
          Math.floor(roi.x), 
          Math.floor(roi.y), 
          Math.floor(roi.w), 
          Math.floor(roi.h)
      );
      const data = imgData.data;
      const width = imgData.width;
      
      let totalY = 0;
      let totalWeight = 0;
      const stride = 4; // Optimization
      
      for (let i = 0; i < data.length; i += (4 * stride)) {
          // data[i+1] is Green channel
          if (data[i+1] > CONFIG.tapeBrightness) {
              const pixelIndex = i / 4;
              const y = Math.floor(pixelIndex / width);
              totalY += y;
              totalWeight++;
          }
      }

      if (totalWeight > 0) {
          let localY = totalY / totalWeight;
          // Normalize to global 0.0 - 1.0 height
          return (roi.y + localY) / canvasRef.current!.height;
      }
      return null;
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
              // Velocity in arbitary units scaled.
              // For real usage, would need calibration (pixel to meter).
              // Using a scalar 2.5 for demo effect matching the HTML prototype.
              const vel = (dy / dt) * 2.5; 
              
              if (dy > CONFIG.movementThreshold) {
                  state.lastMovementTime = timeInSeconds;
                  setVelocity(vel);
                  setStatus(t.vbtStatusMeasuring);
              }
          }
      }

      // Silence threshold
      if (timeInSeconds - state.lastMovementTime > CONFIG.silenceThreshold && state.isRecording) {
           finishSet();
      }
  };

  const finishSet = () => {
      stateRef.current.lastMovementTime = Date.now() / 1000 + 1000; // Delay next trigger
      setStatus(t.vbtStatusDone);
      beep();
      
      setTimeout(() => {
          stateRef.current.positions = [];
          setVelocity(0);
          setStatus(t.vbtStatusReady);
      }, 3000);
  };

  // Cleanup
  useEffect(() => {
      return () => {
          stateRef.current.isRecording = false;
          if (videoRef.current && videoRef.current.srcObject) {
              const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
              tracks.forEach(t => t.stop());
          }
      };
  }, []);

  return (
    <div className="fixed inset-0 bg-black text-white z-50 flex flex-col font-sans">
        
        {/* Fullscreen Video/Canvas Stack */}
        <div className="absolute inset-0 z-0">
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover" 
            />
            <canvas 
                ref={canvasRef} 
                className="absolute top-0 left-0 w-full h-full object-cover z-10 opacity-80" 
            />
        </div>

        {/* UI Overlay */}
        <div className="relative z-20 flex flex-col h-full pointer-events-none">
            
            {/* Header */}
            <div className="p-4 flex justify-between items-start pointer-events-auto">
                <button 
                    onClick={onBack}
                    className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20 text-white"
                >
                    <ArrowLeft size={20} />
                </button>
                
                <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                    <Camera size={14} className="text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">VBT Analyzer</span>
                </div>

                <div className="relative group">
                     <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20 text-white">
                        <Settings2 size={20} />
                     </button>
                     {/* Mode Selector Dropdown */}
                     <div className="absolute right-0 top-12 bg-slate-900 border border-slate-700 rounded-xl p-2 w-48 shadow-xl hidden group-hover:block pointer-events-auto">
                        <button 
                            onClick={() => setMode('overlay')}
                            className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg mb-1 ${mode === 'overlay' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:bg-slate-800'}`}
                        >
                            {t.vbtModeBox}
                        </button>
                        <button 
                            onClick={() => setMode('auto')}
                            className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg ${mode === 'auto' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:bg-slate-800'}`}
                        >
                            {t.vbtModeAuto}
                        </button>
                     </div>
                </div>
            </div>

            {/* Target Box Overlay */}
            {mode === 'overlay' && isRecording && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)] rounded-lg flex items-center justify-center">
                    <div className="w-4 h-1 bg-cyan-400/50 absolute top-0 left-1/2 -translate-x-1/2"></div>
                    <div className="w-4 h-1 bg-cyan-400/50 absolute bottom-0 left-1/2 -translate-x-1/2"></div>
                    <div className="w-1 h-4 bg-cyan-400/50 absolute left-0 top-1/2 -translate-y-1/2"></div>
                    <div className="w-1 h-4 bg-cyan-400/50 absolute right-0 top-1/2 -translate-y-1/2"></div>
                </div>
            )}

            {/* Main Stats Display */}
            <div className="flex-1 flex flex-col items-center justify-center pb-20">
                 {!isRecording ? (
                     <div className="text-center px-6">
                         <h2 className="text-2xl font-black uppercase mb-4 tracking-tight">VBT Setup</h2>
                         <p className="text-slate-300 text-sm mb-8 max-w-xs mx-auto leading-relaxed">
                            {t.vbtInstruction}
                         </p>
                         <button 
                            onClick={startCamera}
                            className="bg-cyan-500 hover:bg-cyan-400 text-black px-8 py-4 rounded-full font-black uppercase tracking-widest flex items-center gap-3 shadow-[0_0_30px_rgba(6,182,212,0.4)] pointer-events-auto transition-transform active:scale-95"
                         >
                             <Play fill="currentColor" size={20} />
                             {t.vbtStart}
                         </button>
                     </div>
                 ) : (
                     <div className="text-center mt-auto mb-12">
                         <div className={`text-lg font-bold uppercase tracking-widest mb-2 transition-colors duration-300 ${status === t.vbtStatusDone ? 'text-red-500 scale-110' : status === t.vbtStatusMeasuring ? 'text-green-400' : 'text-slate-400'}`}>
                             {status}
                         </div>
                         <div className="text-8xl font-black font-mono tracking-tighter tabular-nums text-yellow-400 drop-shadow-2xl">
                             {velocity.toFixed(2)}
                             <span className="text-lg text-yellow-500/80 font-bold ml-2">m/s</span>
                         </div>
                     </div>
                 )}
            </div>
            
            {/* Bottom Bar (Optional Debug or Mini-Graph could go here) */}
        </div>
    </div>
  );
};

export default VbtTest;
