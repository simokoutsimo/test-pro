
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { translations } from '../utils/translations';
import { Language } from '../types';

interface JumpTestProps {
    lang?: Language;
    onShowReport?: (data: JumpSessionData) => void;
}

export interface JumpData {
    height: number;
    flightTime: number;
    contactTime: number;
    timestamp: number;
    rsi?: number;
}

export interface JumpSessionData {
    mode: 'cmj' | 'rsi';
    athleteName: string;
    date: string;
    jumps: JumpData[];
}

const JumpTest: React.FC<JumpTestProps> = ({ lang = 'fi', onShowReport }) => {
    const t = translations[lang];
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [uiState, setUiState] = useState({
        height: "0.0",
        flight: "0",
        contact: "0",
        rsi: "0.00",
        fps: "0",
        jumps: 0
    });
    const [mode, setMode] = useState<'cmj' | 'rsi'>('cmj');
    const [isSystemActive, setSystemActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [recentJumps, setRecentJumps] = useState<JumpData[]>([]);

    const logicState = useRef({
        tapeY: 0,
        baseLineY: 0,
        phase: 'GROUND',
        t_takeoff: 0,
        t_landing: 0,
        jumpHeight: 0,
        flightTime: 0,
        contactTime: 0,
        jumpCount: 0,
        lastLandingTime: 0,
        allJumps: [] as JumpData[],
        positionHistory: [] as number[],
        framesPhys: 0,
        lastFpsCheck: 0,
        animationFrameId: 0,
        autoStopTimeout: null as any,
        sessionStartTime: 0,
    }).current;

    const TEST_CONFIG = {
        cmj: {
            tapeBrightness: 220,
            threshold: 0.020,
            minFlightTime: 150,
            maxFlightTime: 1500,
            autoStopDelay: 5000,
            smoothingFrames: 5
        },
        rsi: {
            tapeBrightness: 220,
            threshold: 0.015,
            minFlightTime: 100,
            maxFlightTime: 1000,
            autoStopDelay: 5000,
            minContactTime: 80,
            maxContactTime: 2000,
            smoothingFrames: 5
        }
    };
    const g = 9.81;

    const startSystem = useCallback(async () => {
        setIsLoading(true);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 60, max: 120 }
                }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    if (canvasRef.current && videoRef.current) {
                        canvasRef.current.width = videoRef.current.videoWidth;
                        canvasRef.current.height = videoRef.current.videoHeight;
                    }
                    logicState.sessionStartTime = Date.now();
                    setIsLoading(false);
                    setSystemActive(true);
                };
            }
        } catch (err: any) {
            alert(t.jumpCameraError + ": " + err.message);
            setIsLoading(false);
        }
    }, [logicState, t]);

    useEffect(() => {
        window.scrollTo(0, 1);
        setTimeout(() => window.scrollTo(0, 1), 100);
    }, []);

    useEffect(() => {
        if (!isSystemActive) return;

        const ctx = canvasRef.current!.getContext('2d')!;
        logicState.lastFpsCheck = performance.now();

        setTimeout(() => {
            logicState.baseLineY = logicState.tapeY;
        }, 2000);

        const loop = () => {
            const now = performance.now();
            logicState.framesPhys++;

            ctx.drawImage(videoRef.current!, 0, 0, canvasRef.current!.width, canvasRef.current!.height);

            const roi = { x: ctx.canvas.width*0.35, y: 0, w: ctx.canvas.width*0.3, h: ctx.canvas.height };
            const tapeY = findTape(ctx, roi);
            if (tapeY !== null) {
                logicState.positionHistory.push(tapeY);
                if (logicState.positionHistory.length > TEST_CONFIG[mode].smoothingFrames) {
                    logicState.positionHistory.shift();
                }

                const smoothedY = logicState.positionHistory.reduce((a, b) => a + b, 0) / logicState.positionHistory.length;
                logicState.tapeY = smoothedY;
                updatePhysics(smoothedY, now / 1000);

                ctx.fillStyle = '#0f0';
                ctx.shadowColor = '#0f0';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(ctx.canvas.width/2, smoothedY * ctx.canvas.height, 12, 0, 2 * Math.PI);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            logicState.animationFrameId = requestAnimationFrame(loop);
        };

        const uiInterval = setInterval(() => {
            const now = performance.now();
            const elapsed = now - logicState.lastFpsCheck;
            const fps = (logicState.framesPhys / (elapsed / 1000)).toFixed(0);

            const rsi = logicState.contactTime > 0 ? logicState.flightTime / logicState.contactTime : 0;

            setUiState({
                height: logicState.jumpHeight.toFixed(1),
                flight: logicState.flightTime.toFixed(0),
                contact: logicState.contactTime.toFixed(0),
                rsi: rsi.toFixed(2),
                fps: fps,
                jumps: logicState.jumpCount
            });

            setRecentJumps([...logicState.allJumps].slice(-3).reverse());

            logicState.lastFpsCheck = now;
            logicState.framesPhys = 0;
        }, 300);

        loop();

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

    }, [isSystemActive, logicState, t, mode]);

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
        const config = TEST_CONFIG[mode];

        if (logicState.phase === 'GROUND') {
            if (y < logicState.baseLineY - config.threshold) {
                logicState.phase = 'FLIGHT';
                logicState.t_takeoff = t;

                if (mode === 'rsi' && logicState.t_landing > 0) {
                    const contactMs = (t - logicState.t_landing) * 1000;
                    const rsiConfig = TEST_CONFIG.rsi;
                    if (contactMs > rsiConfig.minContactTime && contactMs < rsiConfig.maxContactTime) {
                        logicState.contactTime = contactMs;
                    }
                }

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
                    const jumpHeight = (g * Math.pow(t_sec, 2) / 8) * 100;
                    logicState.jumpHeight = jumpHeight;

                    const rsi = logicState.contactTime > 0 ? flightTimeMs / logicState.contactTime : undefined;

                    const jumpData: JumpData = {
                        height: jumpHeight,
                        flightTime: flightTimeMs,
                        contactTime: logicState.contactTime,
                        timestamp: Date.now(),
                        rsi: rsi
                    };

                    logicState.allJumps.push(jumpData);
                    logicState.jumpCount++;
                    logicState.lastLandingTime = t;

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

        if (logicState.allJumps.length > 0 && onShowReport) {
            const sessionData: JumpSessionData = {
                mode: mode,
                athleteName: 'Athlete',
                date: new Date().toISOString(),
                jumps: logicState.allJumps
            };
            onShowReport(sessionData);
        }
    };
    
    return (
        <div style={styles.container}>
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

            {isSystemActive && (
                <div style={styles.ui}>
                    <div style={styles.header}>
                        <div style={styles.modeBadge}>{mode === 'cmj' ? t.jumpCMJ : t.jumpRSI}</div>
                        <div style={styles.jumpCounter}>{t.jumpJumps}: {uiState.jumps}</div>
                    </div>

                    <div style={styles.mainMetrics}>
                        <div style={styles.metricCard}>
                            <div style={styles.metricLabel}>{t.jumpHeight}</div>
                            <div style={styles.metricValue}>{uiState.height} <span style={styles.unit}>cm</span></div>
                        </div>
                        <div style={styles.metricCard}>
                            <div style={styles.metricLabel}>{t.jumpFlightTime}</div>
                            <div style={styles.metricValue}>{uiState.flight} <span style={styles.unit}>ms</span></div>
                        </div>
                        {mode === 'rsi' && (
                            <>
                                <div style={styles.metricCard}>
                                    <div style={styles.metricLabel}>{t.jumpContactTime}</div>
                                    <div style={styles.metricValue}>{uiState.contact} <span style={styles.unit}>ms</span></div>
                                </div>
                                <div style={styles.metricCard}>
                                    <div style={styles.metricLabel}>RSI</div>
                                    <div style={styles.metricValue}>{uiState.rsi}</div>
                                </div>
                            </>
                        )}
                    </div>

                    {recentJumps.length > 0 && (
                        <div style={styles.recentJumps}>
                            <div style={styles.recentTitle}>Recent Jumps</div>
                            {recentJumps.map((jump, idx) => (
                                <div key={idx} style={styles.recentJumpCard}>
                                    <span style={styles.recentJumpHeight}>{jump.height.toFixed(1)} cm</span>
                                    <span style={styles.recentJumpTime}>{jump.flightTime.toFixed(0)} ms</span>
                                    {mode === 'rsi' && jump.rsi && (
                                        <span style={styles.recentJumpRsi}>RSI: {jump.rsi.toFixed(2)}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <button onClick={stopSystem} style={styles.stopBtn}>{t.jumpStop}</button>

                    <div style={styles.fps}>FPS: {uiState.fps}</div>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: { position: 'fixed' as const, top: 0, left: 0, width: '100vw', height: '100dvh', minHeight: '100dvh', background: '#000', fontFamily: 'system-ui, sans-serif', color: 'white', overflow: 'hidden', zIndex: 1000, touchAction: 'none' } as React.CSSProperties,
    video: { position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', zIndex: 1, transform: 'scaleX(-1)' } as React.CSSProperties,
    canvas: { position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', zIndex: 2, transform: 'scaleX(-1)' } as React.CSSProperties,
    ui: { position: 'absolute', width: '100%', height: '100%', zIndex: 10, pointerEvents: 'none', display: 'flex', flexDirection: 'column', padding: '20px' } as React.CSSProperties,
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' } as React.CSSProperties,
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', pointerEvents: 'auto' } as React.CSSProperties,
    modeBadge: { background: 'rgba(0,122,255,0.9)', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,122,255,0.3)' } as React.CSSProperties,
    jumpCounter: { background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: '20px', fontSize: '18px', fontWeight: 'bold', backdropFilter: 'blur(10px)' } as React.CSSProperties,
    mainMetrics: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px', pointerEvents: 'none' } as React.CSSProperties,
    metricCard: { background: 'rgba(0,0,0,0.7)', borderRadius: '16px', padding: '16px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' } as React.CSSProperties,
    metricLabel: { fontSize: '11px', color: '#aaa', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } as React.CSSProperties,
    metricValue: { fontSize: '32px', fontWeight: 'bold', color: '#0f0', fontFamily: 'monospace' } as React.CSSProperties,
    unit: { fontSize: '14px', color: '#888', marginLeft: '4px' } as React.CSSProperties,
    recentJumps: { background: 'rgba(0,0,0,0.6)', borderRadius: '12px', padding: '12px', backdropFilter: 'blur(10px)', marginBottom: '20px', pointerEvents: 'none' } as React.CSSProperties,
    recentTitle: { fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' } as React.CSSProperties,
    recentJumpCard: { background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' } as React.CSSProperties,
    recentJumpHeight: { color: '#0f0', fontWeight: 'bold' } as React.CSSProperties,
    recentJumpTime: { color: '#fff' } as React.CSSProperties,
    recentJumpRsi: { color: '#ffa500' } as React.CSSProperties,
    stopBtn: { pointerEvents: 'auto', marginTop: 'auto', padding: '16px', borderRadius: '12px', border: '2px solid #f00', background: 'rgba(255,0,0,0.2)', color: '#f00', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', backdropFilter: 'blur(10px)' } as React.CSSProperties,
    fps: { fontSize: '10px', color: '#555', marginTop: '8px', textAlign: 'center', pointerEvents: 'none' } as React.CSSProperties,
    loader: { fontSize: '16px', color: '#fff' } as React.CSSProperties,
    menuContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', background: 'rgba(0,0,0,0.9)', padding: '40px', borderRadius: '20px', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' } as React.CSSProperties,
    menuTitle: { fontSize: '20px', fontWeight: 'bold', color: '#fff', textAlign: 'center' } as React.CSSProperties,
    switchContainer: { display: 'flex', gap: '12px', marginTop: '5px' } as React.CSSProperties,
    btnToggleLarge: { background: '#222', color: 'white', border: '2px solid #444', padding: '16px 32px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', pointerEvents: 'auto', minWidth: '110px' } as React.CSSProperties,
    btnActive: { background: '#007AFF', borderColor: '#007AFF', boxShadow: '0 4px 20px rgba(0,122,255,0.4)' } as React.CSSProperties,
    startBtn: { pointerEvents: 'auto', padding: '18px 60px', borderRadius: '30px', border: 'none', background: 'linear-gradient(135deg, #007AFF, #0051D5)', color: 'white', fontSize: '18px', fontWeight: 'bold', boxShadow: '0 8px 30px rgba(0,122,255,0.5)', zIndex: 20, cursor: 'pointer', marginTop: '20px' } as React.CSSProperties
};

export default JumpTest;
