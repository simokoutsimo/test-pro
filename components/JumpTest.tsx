
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Target, Play, Square, Footprints, ArrowLeft, Globe } from 'lucide-react';
import { translations } from '../utils/translations';
import { Language } from '../types';
import { trackByColor, calibrateColorFromClick, trackLowestPoint, ColorRange, COLOR_PRESETS, ROI } from '../utils/tracking';

interface JumpTestProps {
    lang?: Language;
    onShowReport?: (data: JumpSessionData) => void;
    onBack?: () => void;
    onToggleLang?: () => void;
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

const JumpTest: React.FC<JumpTestProps> = ({ lang = 'fi', onShowReport, onBack, onToggleLang }) => {
    const t = translations[lang];
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [phase, setPhase] = useState<'menu' | 'calibrate' | 'tracking'>('menu');
    const [mode, setMode] = useState<'cmj' | 'rsi'>('cmj');
    const [isSystemActive, setSystemActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [trackingMethod, setTrackingMethod] = useState<'motion' | 'color'>('motion');
    const [colorRange, setColorRange] = useState<ColorRange>(COLOR_PRESETS.green);
    const [trackingConfidence, setTrackingConfidence] = useState(0);

    const previousFrameRef = useRef<ImageData | null>(null);

    const [uiState, setUiState] = useState({
        height: "0.0",
        flight: "0",
        contact: "0",
        rsi: "0.00",
        fps: "0",
        jumps: 0
    });

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
        framesPhys: 0,
        lastFpsCheck: 0,
        animationFrameId: 0,
        autoStopTimeout: null as any,
        sessionStartTime: 0,
        baselineFrames: 0,
        baselineSum: 0
    }).current;

    const TEST_CONFIG = {
        cmj: {
            threshold: 0.020,
            minFlightTime: 150,
            maxFlightTime: 1500,
            autoStopDelay: 5000,
            baselineFrames: 30
        },
        rsi: {
            threshold: 0.015,
            minFlightTime: 100,
            maxFlightTime: 1000,
            autoStopDelay: 5000,
            minContactTime: 80,
            maxContactTime: 2000,
            baselineFrames: 30
        }
    };
    const g = 9.81;

    const startSystem = useCallback(async (selectedMode: 'cmj' | 'rsi') => {
        setMode(selectedMode);
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
                    setPhase('calibrate');
                };
            }
        } catch (err: any) {
            alert(t.jumpCameraError + ": " + err.message);
            setIsLoading(false);
        }
    }, [logicState, t]);

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (phase !== 'calibrate' || trackingMethod !== 'color' || !canvasRef.current) return;

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
        setSystemActive(true);
        logicState.phase = 'BASELINE';
        logicState.baselineFrames = 0;
        logicState.baselineSum = 0;
        previousFrameRef.current = null;
    };

    useEffect(() => {
        window.scrollTo(0, 1);
        setTimeout(() => window.scrollTo(0, 1), 100);
    }, []);

    useEffect(() => {
        if (!isSystemActive) return;

        const ctx = canvasRef.current!.getContext('2d', { willReadFrequently: true })!;
        logicState.lastFpsCheck = performance.now();

        const frameLoop = () => {
            if (!isSystemActive) return;

            ctx.save();
            ctx.drawImage(videoRef.current!, 0, 0, canvasRef.current!.width, canvasRef.current!.height);

            const roi: ROI = {
                x: 0,
                y: 0,
                w: canvasRef.current!.width,
                h: canvasRef.current!.height
            };

            let trackPoint = null;

            if (trackingMethod === 'motion') {
                trackPoint = trackLowestPoint(ctx, roi, previousFrameRef.current, 20);
                const currentImageData = ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height);
                previousFrameRef.current = currentImageData;
            } else {
                trackPoint = trackByColor(ctx, roi, colorRange, 50);
            }

            if (trackPoint && trackPoint.confidence > 0.3) {
                setTrackingConfidence(trackPoint.confidence);

                const x = trackPoint.x * canvasRef.current!.width;
                const y = trackPoint.y * canvasRef.current!.height;

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

                if (logicState.phase === 'BASELINE') {
                    logicState.baselineSum += trackPoint.y;
                    logicState.baselineFrames++;

                    if (logicState.baselineFrames >= TEST_CONFIG[mode].baselineFrames) {
                        logicState.baseLineY = logicState.baselineSum / logicState.baselineFrames;
                        logicState.phase = 'GROUND';

                        ctx.strokeStyle = '#10b981';
                        ctx.lineWidth = 2;
                        const baseY = logicState.baseLineY * canvasRef.current!.height;
                        ctx.beginPath();
                        ctx.moveTo(0, baseY);
                        ctx.lineTo(canvasRef.current!.width, baseY);
                        ctx.stroke();
                    }
                } else {
                    const now = performance.now() / 1000;
                    updatePhysics(trackPoint.y, now);

                    if (logicState.baseLineY > 0) {
                        ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
                        ctx.lineWidth = 2;
                        const baseY = logicState.baseLineY * canvasRef.current!.height;
                        ctx.beginPath();
                        ctx.moveTo(0, baseY);
                        ctx.lineTo(canvasRef.current!.width, baseY);
                        ctx.stroke();
                    }
                }
            } else {
                setTrackingConfidence(0);
            }

            ctx.restore();

            logicState.framesPhys++;
            const now = performance.now();
            if (now - logicState.lastFpsCheck >= 1000) {
                const fps = Math.round(logicState.framesPhys / ((now - logicState.lastFpsCheck) / 1000));
                setUiState(prev => ({ ...prev, fps: String(fps) }));
                logicState.framesPhys = 0;
                logicState.lastFpsCheck = now;
            }

            logicState.animationFrameId = requestAnimationFrame(frameLoop);
        };

        logicState.animationFrameId = requestAnimationFrame(frameLoop);

        return () => {
            if (logicState.animationFrameId) {
                cancelAnimationFrame(logicState.animationFrameId);
            }
        };
    }, [isSystemActive, colorRange, mode, trackingMethod]);

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

                    setUiState({
                        height: jumpHeight.toFixed(1),
                        flight: flightTimeMs.toFixed(0),
                        contact: logicState.contactTime.toFixed(0),
                        rsi: rsi ? rsi.toFixed(2) : "0.00",
                        fps: uiState.fps,
                        jumps: logicState.jumpCount
                    });

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
            <canvas
                ref={canvasRef}
                style={{ ...styles.canvas, cursor: phase === 'calibrate' && trackingMethod === 'color' ? 'crosshair' : 'default' }}
                onClick={handleCanvasClick}
            />

            {phase === 'menu' && !isLoading && (
                <div style={styles.overlay}>
                    {onBack && (
                        <button
                            onClick={onBack}
                            style={{
                                position: 'absolute',
                                top: '20px',
                                left: '20px',
                                background: 'rgba(0,0,0,0.6)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                color: '#fff',
                                padding: '10px 16px',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                backdropFilter: 'blur(10px)'
                            }}
                        >
                            <ArrowLeft size={16} />
                            Back
                        </button>
                    )}
                    {onToggleLang && (
                        <button
                            onClick={onToggleLang}
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                background: 'rgba(0,0,0,0.6)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                color: '#fff',
                                padding: '10px',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '40px',
                                height: '40px',
                                backdropFilter: 'blur(10px)'
                            }}
                        >
                            <Globe size={16} />
                        </button>
                    )}
                    <div style={styles.menuContainer}>
                        <Target size={64} style={{ margin: '0 auto 20px', color: '#22d3ee' }} />
                        <div style={styles.menuTitle}>Select Test</div>
                        <button
                            style={styles.button}
                            onClick={() => startSystem('cmj')}
                        >
                            <Play fill="currentColor" size={20} style={{ marginRight: '8px' }} />
                            CMJ - Counter Movement Jump
                        </button>
                        <button
                            style={styles.button}
                            onClick={() => startSystem('rsi')}
                        >
                            <Play fill="currentColor" size={20} style={{ marginRight: '8px' }} />
                            RSI - Reactive Strength Index
                        </button>
                    </div>
                </div>
            )}

            {isLoading && (
                <div style={styles.overlay}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{t.jumpLoading}</div>
                </div>
            )}

            {phase === 'calibrate' && (
                <div style={styles.uiOverlay}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                        <div style={{ ...styles.infoPanel, textAlign: 'center', maxWidth: '320px' }}>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#22d3ee', marginBottom: '16px' }}>
                                Choose tracking method
                            </div>

                            <button
                                onClick={() => {
                                    setTrackingMethod('motion');
                                    startTracking();
                                }}
                                style={{ ...styles.trackMethodBtn, marginBottom: '12px', background: trackingMethod === 'motion' ? 'rgba(34, 211, 238, 0.2)' : 'rgba(0,0,0,0.6)', border: trackingMethod === 'motion' ? '2px solid #22d3ee' : '1px solid rgba(255,255,255,0.2)' }}
                            >
                                <Footprints size={24} style={{ marginRight: '12px' }} />
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Track Foot</div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Motion-based (recommended)</div>
                                </div>
                            </button>

                            <div style={{ fontSize: '12px', color: '#64748b', margin: '8px 0' }}>OR</div>

                            <button
                                onClick={() => {
                                    setTrackingMethod('color');
                                }}
                                style={{ ...styles.trackMethodBtn, background: trackingMethod === 'color' ? 'rgba(34, 211, 238, 0.2)' : 'rgba(0,0,0,0.6)', border: trackingMethod === 'color' ? '2px solid #22d3ee' : '1px solid rgba(255,255,255,0.2)' }}
                            >
                                <Target size={24} style={{ marginRight: '12px' }} />
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Track Tape</div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Tap marker after selecting</div>
                                </div>
                            </button>
                        </div>

                        {trackingMethod === 'color' && (
                            <div style={{ ...styles.infoPanel, padding: '12px 16px' }}>
                                <div style={{ fontSize: '12px', color: '#22d3ee', marginBottom: '8px', fontWeight: 'bold' }}>
                                    Tap bright marker on screen
                                </div>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    {Object.entries(COLOR_PRESETS).map(([name, preset]) => (
                                        <button
                                            key={name}
                                            onClick={() => {
                                                setColorRange(preset);
                                                startTracking();
                                            }}
                                            style={{ ...styles.presetBtn }}
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {phase === 'tracking' && isSystemActive && (
                <div style={styles.uiOverlay}>
                    <div style={styles.headerBar}>
                        <div style={styles.modeTag}>
                            {mode === 'cmj' ? 'CMJ' : 'RSI'}
                        </div>
                        <div style={{ ...styles.statPill, border: trackingConfidence > 0.7 ? '1px solid #10b981' : '1px solid #ef4444' }}>
                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>Track: </span>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: trackingConfidence > 0.7 ? '#10b981' : '#ef4444' }}>
                                {(trackingConfidence * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>

                    <div style={{ flex: 1 }} />

                    <div style={styles.bottomPanel}>
                        <div style={styles.statsRow}>
                            <div style={styles.statBox}>
                                <div style={styles.statLabel}>{t.jumpHeight}</div>
                                <div style={styles.statValue}>{uiState.height}</div>
                                <div style={styles.statUnit}>cm</div>
                            </div>
                            <div style={styles.statBox}>
                                <div style={styles.statLabel}>{t.jumpFlightTime}</div>
                                <div style={styles.statValue}>{uiState.flight}</div>
                                <div style={styles.statUnit}>ms</div>
                            </div>
                            {mode === 'rsi' && (
                                <div style={styles.statBox}>
                                    <div style={styles.statLabel}>RSI</div>
                                    <div style={styles.statValue}>{uiState.rsi}</div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                            <div style={styles.statPill}>
                                <span style={{ fontSize: '10px', color: '#94a3b8' }}>Jumps: </span>
                                <span style={{ fontSize: '18px', fontWeight: 'black', color: '#22d3ee' }}>{uiState.jumps}</span>
                            </div>
                            <button
                                style={styles.stopBtn}
                                onClick={stopSystem}
                            >
                                <Square size={16} style={{ marginRight: '6px' }} />
                                Stop
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    container: { position: 'fixed' as const, top: 0, left: 0, width: '100vw', height: '100dvh', minHeight: '100dvh', background: '#000', fontFamily: 'system-ui, sans-serif', color: 'white', overflow: 'hidden', zIndex: 1000, touchAction: 'none' } as React.CSSProperties,
    video: { position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', zIndex: 1, transform: 'scaleX(-1)' } as React.CSSProperties,
    canvas: { position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', zIndex: 2, transform: 'scaleX(-1)' } as React.CSSProperties,
    uiOverlay: { position: 'absolute', width: '100%', height: '100%', zIndex: 10, pointerEvents: 'none', display: 'flex', flexDirection: 'column', padding: '0' } as React.CSSProperties,
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' } as React.CSSProperties,
    menuContainer: { textAlign: 'center', padding: '32px', maxWidth: '400px' } as React.CSSProperties,
    menuTitle: { fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '2px' } as React.CSSProperties,
    button: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '16px 24px', marginBottom: '12px', background: '#22d3ee', color: '#000', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', transition: 'all 0.2s', pointerEvents: 'auto' } as React.CSSProperties,
    headerBar: { padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)', pointerEvents: 'none' } as React.CSSProperties,
    modeTag: { padding: '6px 12px', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#22d3ee' } as React.CSSProperties,
    statPill: { padding: '6px 12px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '20px' } as React.CSSProperties,
    bottomPanel: { padding: '16px', background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.6))', backdropFilter: 'blur(12px)', pointerEvents: 'auto' } as React.CSSProperties,
    statsRow: { display: 'flex', justifyContent: 'space-around', gap: '8px', marginBottom: '12px' } as React.CSSProperties,
    statBox: { flex: 1, textAlign: 'center', background: 'rgba(0,0,0,0.6)', borderRadius: '12px', padding: '12px 8px', border: '1px solid rgba(255,255,255,0.1)' } as React.CSSProperties,
    statLabel: { fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', fontWeight: '600' } as React.CSSProperties,
    statValue: { fontSize: '28px', fontWeight: 'black', fontFamily: 'monospace', color: '#fbbf24', lineHeight: '1' } as React.CSSProperties,
    statUnit: { fontSize: '12px', color: '#fbbf24', marginTop: '2px', fontWeight: 'bold' } as React.CSSProperties,
    stopBtn: { padding: '12px 24px', background: 'rgba(239, 68, 68, 0.2)', border: '2px solid #ef4444', borderRadius: '12px', color: '#ef4444', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s', pointerEvents: 'auto' } as React.CSSProperties,
    presetBtn: { padding: '8px 16px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: 'bold', textTransform: 'capitalize', cursor: 'pointer', pointerEvents: 'auto' } as React.CSSProperties,
    infoPanel: { padding: '24px', background: 'rgba(0,0,0,0.8)', borderRadius: '16px', border: '1px solid rgba(34, 211, 238, 0.3)', backdropFilter: 'blur(12px)' } as React.CSSProperties,
    trackMethodBtn: { display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%', padding: '14px 18px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', pointerEvents: 'auto' } as React.CSSProperties
};

export default JumpTest;
