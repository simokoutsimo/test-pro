
import React, { useRef, useEffect, useState, useCallback } from 'react';

// Nämä kirjastot ladataan globaalisti <script>-tageilla, joten tarvitsemme tyyppimääritelmät.
declare const Pose: any;
declare const POSE_CONNECTIONS: any;
declare const drawConnectors: any;
declare const drawLandmarks: any;

const JumpTest: React.FC = () => {
    // 1. REFs SUORAA DOM-MANIPULAATIOTA VARTEN
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // 2. USESTATE VAIN HARVOIN PÄIVITTYVÄÄ UI-TILAA VARTEN
    const [uiState, setUiState] = useState({
        height: "0.0 cm",
        flight: "0 ms",
        angle: "--°",
        fps: "Phys: 0 / AI: 0"
    });
    const [mode, setMode] = useState('cmj');
    const [isSystemActive, setSystemActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // 3. USEREF KAIKKEEN KORKEAN TAAJUUDEN DATAAN (EI RE-RENDEREITÄ)
    const logicState = useRef({
        // Fysiikka
        tapeY: 0,
        baseLineY: 0,
        phase: 'GROUND', // GROUND, FLIGHT
        t_takeoff: 0,
        jumpHeight: 0,
        flightTime: 0,
        // AI
        poseLandmarks: null,
        kneeAngle: 0,
        aiProcessing: false,
        // Suorituskyky
        framesPhys: 0,
        framesAI: 0,
        lastFpsCheck: 0,
        // Loop control
        animationFrameId: 0,
        pose: null as any,
    }).current;

    const CONFIG = { tapeBrightness: 220, g: 9.81 };

    // --- APUFUNKTIOT (Pysyvät samoina) ---
    const calculateAngle = (a: any, b: any, c: any) => {
        const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs(rad * 180.0 / Math.PI);
        if (angle > 180.0) angle = 360 - angle;
        return angle;
    };

    // --- KÄYNNISTYS & ALUSTUS ---
    const startSystem = useCallback(async () => {
        setIsLoading(true);

        // Lataa MediaPipe-skriptit dynaamisesti
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
        const poseScript = await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
        
        if(!poseScript) {
            alert("Tekoälymallin lataus epäonnistui.");
            setIsLoading(false);
            return;
        }
        
        logicState.pose = new Pose({locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`});
        logicState.pose.setOptions({
            modelComplexity: 0,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        logicState.pose.onResults(onPoseResults);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 } }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    if (canvasRef.current && videoRef.current) {
                        canvasRef.current.width = videoRef.current.videoWidth;
                        canvasRef.current.height = videoRef.current.videoHeight;
                    }
                    setIsLoading(false);
                    setSystemActive(true);
                };
            }
        } catch (err: any) {
            alert("Kameravirhe: " + err.message);
            setIsLoading(false);
        }
    }, [logicState]);
    
    const loadScript = (src: string) => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = src;
            script.crossOrigin = 'anonymous';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    }

    // --- AI-TULOSTEN KÄSITTELY ---
    const onPoseResults = (results: any) => {
        logicState.poseLandmarks = results.poseLandmarks;
        logicState.aiProcessing = false;
        logicState.framesAI++;
        if (results.poseLandmarks) {
            const l = results.poseLandmarks;
            const p1 = l[24], p2 = l[26], p3 = l[28]; // Oikea polvi
            if (p1.visibility > 0.5 && p2.visibility > 0.5 && p3.visibility > 0.5) {
               logicState.kneeAngle = Math.round(calculateAngle(p1, p2, p3));
            }
        }
    };

    // --- PÄÄLOOPPI & FYSIIKKA (useEffect) ---
    useEffect(() => {
        if (!isSystemActive) return;

        const ctx = canvasRef.current!.getContext('2d')!;
        logicState.lastFpsCheck = performance.now();
        
        // Kalibroidaan lähtötaso 2s käynnistyksen jälkeen
        setTimeout(() => { 
            logicState.baseLineY = logicState.tapeY; 
            console.log("Hybridi-järjestelmä kalibroitu. Lähtötaso (Y):", logicState.baseLineY);
        }, 2000);

        const loop = () => {
            const now = performance.now();
            logicState.framesPhys++;
            
            ctx.drawImage(videoRef.current!, 0, 0, canvasRef.current!.width, canvasRef.current!.height);

            // 1. FYSIIKKA (Vihreän teipin seuranta)
            const roi = { x: ctx.canvas.width*0.4, y: 0, w: ctx.canvas.width*0.2, h: ctx.canvas.height };
            const tapeY = findTape(ctx, roi);
            if (tapeY !== null) {
                logicState.tapeY = tapeY;
                updatePhysics(tapeY, now / 1000);
                
                ctx.fillStyle = '#0f0';
                ctx.beginPath();
                ctx.arc(ctx.canvas.width/2, tapeY * ctx.canvas.height, 10, 0, 2 * Math.PI);
                ctx.fill();
            }
            
            // 2. AI (Lähetetään kuva throttlatusti)
            if (videoRef.current && !logicState.aiProcessing) {
                logicState.aiProcessing = true;
                logicState.pose.send({ image: videoRef.current });
            }
            
            // 3. VISUALISOINTI (Piirretään luuranko)
            if (logicState.poseLandmarks) {
                drawConnectors(ctx, logicState.poseLandmarks, POSE_CONNECTIONS, { color: '#00f', lineWidth: 2 });
                drawLandmarks(ctx, logicState.poseLandmarks, { color: '#00f', radius: 3 });
            }

            logicState.animationFrameId = requestAnimationFrame(loop);
        };
        
        // UI-päivityslenkki (hidas)
        const uiInterval = setInterval(() => {
            const now = performance.now();
            const elapsed = now - logicState.lastFpsCheck;
            const physFps = (logicState.framesPhys / (elapsed / 1000)).toFixed(0);
            const aiFps = (logicState.framesAI / (elapsed / 1000)).toFixed(0);

            setUiState({
                height: logicState.jumpHeight.toFixed(1) + " cm",
                flight: logicState.flightTime.toFixed(0) + " ms",
                angle: logicState.kneeAngle + "°",
                fps: `Phys: ${physFps} / AI: ${aiFps}`
            });

            logicState.lastFpsCheck = now;
            logicState.framesPhys = 0;
            logicState.framesAI = 0;
        }, 500); // Päivitetään UI vain 2 kertaa sekunnissa

        loop();

        // Siivousfunktio
        return () => {
            cancelAnimationFrame(logicState.animationFrameId);
            clearInterval(uiInterval);
            if(videoRef.current?.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
        };

    }, [isSystemActive, logicState]);

    const findTape = (ctx: CanvasRenderingContext2D, roi: any) => {
        const imgData = ctx.getImageData(roi.x, roi.y, roi.w, roi.h);
        const data = imgData.data;
        let bestY = -1, bestG = 0;
        
        for (let i = 0; i < data.length; i += 8) { // Hypitään pikseleitä
            const r = data[i], g = data[i+1], b = data[i+2];
            if (g > CONFIG.tapeBrightness && g > r + 20 && g > b + 20 && g > bestG) {
                bestG = g;
                bestY = Math.floor((i / 4) / roi.w);
            }
        }
        return bestY !== -1 ? (roi.y + bestY) / ctx.canvas.height : null;
    };

    const updatePhysics = (y: number, t: number) => {
        if (logicState.phase === 'GROUND') {
            if (y < logicState.baseLineY - 0.03) { // 3% toleranssi
                 logicState.phase = 'FLIGHT';
                 logicState.t_takeoff = t;
            }
        } else if (logicState.phase === 'FLIGHT') {
            if (y > logicState.baseLineY - 0.03) {
                logicState.phase = 'GROUND';
                const flightTimeMs = (t - logicState.t_takeoff) * 1000;
                if (flightTimeMs > 100 && flightTimeMs < 1500) { // Suodatus
                    logicState.flightTime = flightTimeMs;
                    const t_sec = flightTimeMs / 1000;
                    logicState.jumpHeight = (CONFIG.g * Math.pow(t_sec, 2) / 8) * 100;
                }
            }
        }
    };
    
    return (
        <div style={{...styles.container, position: 'fixed', top: 0, left: 0, zIndex: 1000}}>
            <video ref={videoRef} style={styles.video} autoPlay playsInline muted />
            <canvas ref={canvasRef} style={styles.canvas} />

            {!isSystemActive && (
                <div style={styles.overlay}>
                    {!isLoading ? 
                        <button onClick={startSystem} style={styles.startBtn}>START HYBRID SYSTEM</button> :
                        <div style={styles.loader}>Ladataan tekoälymalleja...</div>
                    }
                </div>
            )}

            <div style={styles.ui}>
                <div style={{...styles.hudPanel, width: '180px'}}>
                    <div style={styles.label}>JUMP HEIGHT</div>
                    <div style={{...styles.bigVal, ...styles.highlight}}>{uiState.height}</div>
                    <div style={{...styles.label, marginTop: '5px'}}>FLIGHT TIME</div>
                    <div style={styles.bigVal}>{uiState.flight}</div>
                    
                    <div style={styles.switchContainer}>
                        <button style={mode === 'cmj' ? {...styles.btnToggle, ...styles.btnActive} : styles.btnToggle} onClick={() => setMode('cmj')}>CMJ</button>
                        <button style={mode === 'rsi' ? {...styles.btnToggle, ...styles.btnActive} : styles.btnToggle} onClick={() => setMode('rsi')}>RSI</button>
                    </div>
                </div>
                <div style={{...styles.hudPanel, ...styles.kneeIndicator}}>
                    <div style={styles.label}>KNEE ANGLE</div>
                    <div style={styles.bigVal}>{uiState.angle}</div>
                    <div style={styles.label}>{uiState.fps}</div>
                </div>
            </div>
        </div>
    );
}

// Koska emme käytä CSS-tiedostoja, määritellään tyylit objekteina
const styles = {
    container: { position: 'relative', width: '100vw', height: '100vh', background: '#000', fontFamily: 'Roboto Mono, monospace', color: 'white', overflow: 'hidden' } as React.CSSProperties,
    video: { position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', zIndex: 1, transform: 'scaleX(-1)' } as React.CSSProperties,
    canvas: { position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', zIndex: 2, transform: 'scaleX(-1)' } as React.CSSProperties,
    ui: { position: 'absolute', width: '100%', height: '100%', zIndex: 10, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } as React.CSSProperties,
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, display: 'flex', justifyContent: 'center', alignItems: 'center'} as React.CSSProperties,
    hudPanel: { background: 'rgba(0,0,0,0.6)', padding: '10px', margin: '10px', borderRadius: '8px', backdropFilter: 'blur(5px)', borderLeft: '4px solid #00f', pointerEvents: 'auto' } as React.CSSProperties,
    bigVal: { fontSize: '28px', fontWeight: 'bold', color: '#fff' } as React.CSSProperties,
    label: { fontSize: '10px', color: '#aaa', textTransform: 'uppercase' } as React.CSSProperties,
    highlight: { color: '#0f0' } as React.CSSProperties,
    kneeIndicator: { position: 'absolute', bottom: '20px', right: '20px', textAlign: 'right' } as React.CSSProperties,
    switchContainer: { display: 'flex', gap: '10px', marginTop: '5px' } as React.CSSProperties,
    btnToggle: { background: '#333', color: 'white', border: '1px solid #555', padding: '5px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', pointerEvents: 'auto' } as React.CSSProperties,
    btnActive: { background: '#007AFF', borderColor: '#007AFF' } as React.CSSProperties,
    startBtn: { pointerEvents: 'auto', padding: '20px 60px', borderRadius: '40px', border: 'none', background: '#00f', color: 'white', fontSize: '20px', fontWeight: 'bold', boxShadow: '0 0 30px rgba(0,0,255,0.5)', zIndex: 20, cursor: 'pointer' } as React.CSSProperties,
    loader: { fontSize: '14px', color: '#aaa' } as React.CSSProperties
};


export default JumpTest;
