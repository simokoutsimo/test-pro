
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { translations } from '../utils/translations';
import { Language } from '../types';

// Nämä kirjastot ladataan globaalisti <script>-tageilla, joten tarvitsemme tyyppimääritelmät.
declare const Pose: any;
declare const POSE_CONNECTIONS: any;
declare const drawConnectors: any;
declare const drawLandmarks: any;

interface JumpTestProps {
    lang?: Language;
}

const JumpTest: React.FC<JumpTestProps> = ({ lang = 'fi' }) => {
    const t = translations[lang];
    // 1. REFs SUORAA DOM-MANIPULAATIOTA VARTEN
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // 2. USESTATE VAIN HARVOIN PÄIVITTYVÄÄ UI-TILAA VARTEN
    const [uiState, setUiState] = useState({
        height: "0.0 cm",
        flight: "0 ms",
        contact: "0 ms",
        angle: "--°",
        fps: "Phys: 0 / AI: 0",
        jumps: 0
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
        t_landing: 0,
        jumpHeight: 0,
        flightTime: 0,
        contactTime: 0,
        jumpCount: 0,
        lastLandingTime: 0,
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
        autoStopTimeout: null as any,
    }).current;

    // Test-specific configurations
    const TEST_CONFIG = {
        cmj: {
            tapeBrightness: 220,
            threshold: 0.025,
            minFlightTime: 100,
            maxFlightTime: 1500,
            autoStopDelay: 3000
        },
        rsi: {
            tapeBrightness: 220,
            threshold: 0.020, // Tarkempi tunnistus RSI:lle
            minFlightTime: 80,
            maxFlightTime: 1000,
            autoStopDelay: 3000,
            minContactTime: 50,
            maxContactTime: 3000
        }
    };
    const g = 9.81;

    // --- APUFUNKTIOT (Pysyvät samoina) ---
    const calculateAngle = (a: any, b: any, c: any) => {
        const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs(rad * 180.0 / Math.PI);
        if (angle > 180.0) angle = 360 - angle;
        return angle;
    };

    // --- AI-TULOSTEN KÄSITTELY ---
    const onPoseResults = (results: any) => {
        logicState.poseLandmarks = results.poseLandmarks;
        logicState.aiProcessing = false;
        logicState.framesAI++;
        if (results.poseLandmarks) {
            const l = results.poseLandmarks;
            const p1 = l[24], p2 = l[26], p3 = l[28];
            if (p1.visibility > 0.5 && p2.visibility > 0.5 && p3.visibility > 0.5) {
               logicState.kneeAngle = Math.round(calculateAngle(p1, p2, p3));
            }
        }
    };

    // --- KÄYNNISTYS & ALUSTUS ---
    const startSystem = useCallback(async () => {
        setIsLoading(true);

        // Lataa MediaPipe-skriptit dynaamisesti
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
        const poseScript = await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');

        if(!poseScript) {
            alert(t.jumpLoading.replace('...', ' epäonnistui'));
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
            alert(t.jumpCameraError + ": " + err.message);
            setIsLoading(false);
        }
    }, [logicState, t]);
    
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
                contact: logicState.contactTime.toFixed(0) + " ms",
                angle: logicState.kneeAngle + "°",
                fps: `${t.jumpPhys}: ${physFps} / ${t.jumpAI}: ${aiFps}`,
                jumps: logicState.jumpCount
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
            if (logicState.autoStopTimeout) {
                clearTimeout(logicState.autoStopTimeout);
            }
            if(videoRef.current?.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
        };

    }, [isSystemActive, logicState, t]);

    const findTape = (ctx: CanvasRenderingContext2D, roi: any) => {
        const config = TEST_CONFIG[mode as 'cmj' | 'rsi'];
        const imgData = ctx.getImageData(roi.x, roi.y, roi.w, roi.h);
        const data = imgData.data;
        let bestY = -1, bestG = 0;

        for (let i = 0; i < data.length; i += 8) {
            const r = data[i], gVal = data[i+1], b = data[i+2];
            if (gVal > config.tapeBrightness && gVal > r + 20 && gVal > b + 20 && gVal > bestG) {
                bestG = gVal;
                bestY = Math.floor((i / 4) / roi.w);
            }
        }
        return bestY !== -1 ? (roi.y + bestY) / ctx.canvas.height : null;
    };

    const updatePhysics = (y: number, t: number) => {
        const config = TEST_CONFIG[mode as 'cmj' | 'rsi'];

        if (logicState.phase === 'GROUND') {
            if (y < logicState.baseLineY - config.threshold) {
                logicState.phase = 'FLIGHT';
                logicState.t_takeoff = t;

                // Laske kontaktiaika (vain RSI:ssä)
                if (mode === 'rsi' && logicState.t_landing > 0) {
                    const contactMs = (t - logicState.t_landing) * 1000;
                    const rsiConfig = TEST_CONFIG.rsi;
                    if (contactMs > rsiConfig.minContactTime && contactMs < rsiConfig.maxContactTime) {
                        logicState.contactTime = contactMs;
                    }
                }

                // Tyhjennä autostop jos oli asetettu
                if (logicState.autoStopTimeout) {
                    clearTimeout(logicState.autoStopTimeout);
                    logicState.autoStopTimeout = null;
                }
            }
        } else if (logicState.phase === 'FLIGHT') {
            if (y > logicState.baseLineY - config.threshold) {
                logicState.phase = 'GROUND';
                logicState.t_landing = t;
                const flightTimeMs = (t - logicState.t_takeoff) * 1000;

                if (flightTimeMs > config.minFlightTime && flightTimeMs < config.maxFlightTime) {
                    logicState.flightTime = flightTimeMs;
                    const t_sec = flightTimeMs / 1000;
                    logicState.jumpHeight = (g * Math.pow(t_sec, 2) / 8) * 100;
                    logicState.jumpCount++;
                    logicState.lastLandingTime = t;

                    // Aseta autostop
                    if (logicState.autoStopTimeout) {
                        clearTimeout(logicState.autoStopTimeout);
                    }
                    logicState.autoStopTimeout = setTimeout(() => {
                        stopSystem();
                    }, config.autoStopDelay);
                }
            }
        }
    };

    const stopSystem = () => {
        setSystemActive(false);
        if (logicState.autoStopTimeout) {
            clearTimeout(logicState.autoStopTimeout);
            logicState.autoStopTimeout = null;
        }
    };
    
    const containerStyle = {...styles.container, position: 'fixed' as const, top: 0, left: 0, zIndex: 1000};

    return (
        <div style={containerStyle}>
            <video ref={videoRef} style={styles.video} autoPlay playsInline muted />
            <canvas ref={canvasRef} style={styles.canvas} />

            {!isSystemActive && (
                <div style={styles.overlay}>
                    {!isLoading ? (
                        <div style={styles.menuContainer}>
                            <div style={styles.menuTitle}>Valitse testi / Select test</div>
                            <div style={styles.switchContainer}>
                                <button
                                    style={mode === 'cmj' ? {...styles.btnToggleLarge, ...styles.btnActive} : styles.btnToggleLarge}
                                    onClick={() => setMode('cmj')}
                                >
                                    {t.jumpCMJ}
                                </button>
                                <button
                                    style={mode === 'rsi' ? {...styles.btnToggleLarge, ...styles.btnActive} : styles.btnToggleLarge}
                                    onClick={() => setMode('rsi')}
                                >
                                    {t.jumpRSI}
                                </button>
                            </div>
                            <button onClick={startSystem} style={styles.startBtn}>{t.jumpStart}</button>
                        </div>
                    ) : (
                        <div style={styles.loader}>{t.jumpLoading}</div>
                    )}
                </div>
            )}

            <div style={styles.ui}>
                <div style={{...styles.hudPanel, width: '200px'}}>
                    <div style={{...styles.label, marginBottom: '5px'}}>{mode === 'cmj' ? t.jumpCMJ : t.jumpRSI}</div>

                    <div style={styles.label}>{t.jumpHeight}</div>
                    <div style={{...styles.bigVal, ...styles.highlight}}>{uiState.height}</div>

                    <div style={{...styles.label, marginTop: '5px'}}>{t.jumpFlightTime}</div>
                    <div style={styles.bigVal}>{uiState.flight}</div>

                    {mode === 'rsi' && (
                        <>
                            <div style={{...styles.label, marginTop: '5px'}}>{t.jumpContactTime}</div>
                            <div style={styles.bigVal}>{uiState.contact}</div>
                        </>
                    )}

                    <div style={{...styles.label, marginTop: '10px', fontSize: '12px'}}>{t.jumpJumps}: {uiState.jumps}</div>

                    {isSystemActive && (
                        <button onClick={stopSystem} style={{...styles.stopBtn, marginTop: '10px'}}>{t.jumpStop}</button>
                    )}
                </div>
                <div style={{...styles.hudPanel, ...styles.kneeIndicator}}>
                    <div style={styles.label}>{t.jumpKneeAngle}</div>
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
    startBtn: { pointerEvents: 'auto', padding: '15px 50px', borderRadius: '30px', border: 'none', background: '#00f', color: 'white', fontSize: '18px', fontWeight: 'bold', boxShadow: '0 0 30px rgba(0,0,255,0.5)', zIndex: 20, cursor: 'pointer', marginTop: '20px' } as React.CSSProperties,
    stopBtn: { pointerEvents: 'auto', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #f00', background: 'rgba(255,0,0,0.2)', color: '#f00', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' } as React.CSSProperties,
    loader: { fontSize: '14px', color: '#aaa' } as React.CSSProperties,
    menuContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', background: 'rgba(0,0,0,0.8)', padding: '40px', borderRadius: '12px', backdropFilter: 'blur(10px)' } as React.CSSProperties,
    menuTitle: { fontSize: '18px', fontWeight: 'bold', color: '#fff', textAlign: 'center' } as React.CSSProperties,
    btnToggleLarge: { background: '#333', color: 'white', border: '2px solid #555', padding: '15px 30px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', pointerEvents: 'auto', minWidth: '100px' } as React.CSSProperties
};


export default JumpTest;
