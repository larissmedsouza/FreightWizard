"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import createGlobe from "cobe"

interface PortMarker {
  id: string
  location: [number, number]
  region: string
}

interface TradeLane {
  id: string
  from: [number, number]
  to: [number, number]
}

const markers: PortMarker[] = [
  { id: "rotterdam", location: [51.9244, 4.4777], region: "Rotterdam" },
  { id: "shanghai", location: [31.2304, 121.4737], region: "Shanghai" },
  { id: "santos", location: [-23.9619, -46.3344], region: "Santos" },
  { id: "la", location: [33.749, -118.2616], region: "Los Angeles" },
  { id: "dubai", location: [25.2048, 55.2708], region: "Dubai" },
  { id: "singapore", location: [1.3521, 103.8198], region: "Singapore" },
  { id: "hamburg", location: [53.5753, 9.9551], region: "Hamburg" },
  { id: "newyork", location: [40.6643, -74.0521], region: "New York" },
  { id: "busan", location: [35.1796, 129.0756], region: "Busan" },
  { id: "hongkong", location: [22.3193, 114.1694], region: "Hong Kong" },
]

const arcs: TradeLane[] = [
  { id: "arc-1", from: [51.9244, 4.4777], to: [31.2304, 121.4737] }, // Rotterdam → Shanghai
  { id: "arc-2", from: [31.2304, 121.4737], to: [33.749, -118.2616] }, // Shanghai → LA
  { id: "arc-3", from: [33.749, -118.2616], to: [-23.9619, -46.3344] }, // LA → Santos
  { id: "arc-4", from: [25.2048, 55.2708], to: [51.9244, 4.4777] }, // Dubai → Rotterdam
  { id: "arc-5", from: [1.3521, 103.8198], to: [53.5753, 9.9551] }, // Singapore → Hamburg
  { id: "arc-6", from: [-23.9619, -46.3344], to: [40.6643, -74.0521] }, // Santos → New York
]

// Monthly TEU volume per lane (4200 → "4.2k TEU/mo")
const initialTeu = [4200, 3800, 2900, 1900, 1600, 1300]

const speed = 0.003

const labelStyle: React.CSSProperties = {
  fontFamily: "monospace",
  color: "#ffffff",
  background: "#0a0a1a",
  border: "1px solid rgba(158, 20, 251, 0.4)",
  whiteSpace: "nowrap",
  pointerEvents: "none",
}

export default function FreightGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)
  const [traffic, setTraffic] = useState(() =>
    arcs.map((a, i) => ({ id: a.id, value: initialTeu[i] || 1000 }))
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setTraffic((data) =>
        data.map((t) => ({
          ...t,
          value: Math.max(500, t.value + Math.floor(Math.random() * 21) - 10),
        }))
      )
    }, 250)
    return () => clearInterval(interval)
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY }
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing"
    isPausedRef.current = true
  }, [])

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current += dragOffset.current.theta
      dragOffset.current = { phi: 0, theta: 0 }
    }
    pointerInteracting.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = "grab"
    isPausedRef.current = false
  }, [])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        }
      }
    }
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerup", handlePointerUp, { passive: true })
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [handlePointerUp])

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    let globe: ReturnType<typeof createGlobe> | null = null
    let animationId: number
    let phi = 0

    function init() {
      const width = canvas.offsetWidth
      if (width === 0 || globe) return

      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width, height: width,
        phi: 0, theta: 0.2, dark: 1, diffuse: 1.5,
        mapSamples: 16000, mapBrightness: 10,
        baseColor: [0.3, 0.0, 0.5],
        markerColor: [0.62, 0.08, 0.98],
        glowColor: [0.11, 0.63, 1.0],
        markerElevation: 0.02,
        markers: markers.map((m) => ({ location: m.location, size: 0.012, id: m.id })),
        arcs: arcs.map((a) => ({ from: a.from, to: a.to, id: a.id })),
        arcColor: [0.62, 0.08, 0.98],
        arcWidth: 0.5, arcHeight: 0.25, opacity: 0.7,
      })
      function animate() {
        if (!isPausedRef.current) phi += speed
        globe!.update({
          phi: phi + phiOffsetRef.current + dragOffset.current.phi,
          theta: 0.2 + thetaOffsetRef.current + dragOffset.current.theta,
        })
        animationId = requestAnimationFrame(animate)
      }
      animate()
      setTimeout(() => canvas && (canvas.style.opacity = "1"))
    }

    let ro: ResizeObserver | null = null
    if (canvas.offsetWidth > 0) {
      init()
    } else {
      ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) {
          ro?.disconnect()
          init()
        }
      })
      ro.observe(canvas)
    }

    return () => {
      ro?.disconnect()
      if (animationId) cancelAnimationFrame(animationId)
      if (globe) globe.destroy()
    }
  }, [])

  const pyramidFaceStyle = (nth: number): React.CSSProperties => {
    const transforms = [
      "rotateY(0deg) translateZ(4px) rotateX(19.5deg)",
      "rotateY(120deg) translateZ(4px) rotateX(19.5deg)",
      "rotateY(240deg) translateZ(4px) rotateX(19.5deg)",
      "rotateX(-90deg) rotateZ(60deg) translateY(4px)",
    ]
    const colors = ["#9E14FB", "#7B0ED4", "#5200FF", "#3D00CC"]
    return {
      position: "absolute", left: -0.5, top: 0,
      width: 0, height: 0,
      borderLeft: "6.5px solid transparent",
      borderRight: "6.5px solid transparent",
      borderBottom: `13px solid ${colors[nth]}`,
      transformOrigin: "center bottom",
      transform: transforms[nth],
    }
  }

  return (
    <div className="relative aspect-square select-none">
      <style>{`
        @keyframes pyramid-spin {
          0% { transform: rotateX(20deg) rotateY(0deg); }
          100% { transform: rotateX(20deg) rotateY(360deg); }
        }
      `}</style>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: "100%", height: "100%", cursor: "grab", opacity: 0,
          transition: "opacity 1.2s ease", borderRadius: "50%", touchAction: "none",
        }}
      />
      {markers.map((m) => (
        <div key={m.id} style={{ position: "absolute", positionAnchor: `--cobe-${m.id}`, bottom: "anchor(top)", left: "anchor(center)", translate: "-50% 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, pointerEvents: "none", opacity: `var(--cobe-visible-${m.id}, 0)`, filter: `blur(calc((1 - var(--cobe-visible-${m.id}, 0)) * 8px))`, transition: "opacity 0.3s, filter 0.3s" } as React.CSSProperties}>
          <div style={{ width: 12, height: 12, position: "relative", transformStyle: "preserve-3d", animation: "pyramid-spin 4s linear infinite" }}>
            {[0, 1, 2, 3].map((n) => (<div key={n} style={pyramidFaceStyle(n)} />))}
          </div>
          <span style={{ ...labelStyle, fontSize: "0.55rem", padding: "2px 6px", borderRadius: 3, letterSpacing: "0.05em", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>{m.region}</span>
        </div>
      ))}
      {traffic.map((t) => (
        <div key={t.id} style={{ ...labelStyle, position: "absolute", positionAnchor: `--cobe-arc-${t.id}`, bottom: "anchor(top)", left: "anchor(center)", translate: "-50% 0", fontSize: "0.5rem", padding: "3px 8px", borderRadius: 4, opacity: `var(--cobe-visible-arc-${t.id}, 0)`, filter: `blur(calc((1 - var(--cobe-visible-arc-${t.id}, 0)) * 8px))`, transition: "opacity 0.3s, filter 0.3s" } as React.CSSProperties}>{(t.value / 1000).toFixed(1)}k TEU/mo</div>
      ))}
    </div>
  )
}
