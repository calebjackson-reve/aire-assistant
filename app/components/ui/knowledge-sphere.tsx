"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

const NODE_COUNT = 200
const SPHERE_RADIUS = 2.8
const CONNECTION_DISTANCE = 1.2

function Nodes() {
  const pointsRef = useRef<THREE.Points>(null)
  const linesRef = useRef<THREE.LineSegments>(null)
  const groupRef = useRef<THREE.Group>(null)

  // Generate sphere-distributed points
  const positions = useMemo(() => {
    const pos = new Float32Array(NODE_COUNT * 3)
    for (let i = 0; i < NODE_COUNT; i++) {
      // Fibonacci sphere for even distribution
      const phi = Math.acos(1 - (2 * (i + 0.5)) / NODE_COUNT)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i
      const r = SPHERE_RADIUS * (0.85 + Math.random() * 0.3)
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
    }
    return pos
  }, [])

  // Node colors — sage, copper, cream mix
  const colors = useMemo(() => {
    const cols = new Float32Array(NODE_COUNT * 3)
    const palette = [
      [0.353, 0.420, 0.227], // deep olive #5A6B3A
      [0.478, 0.549, 0.314], // sage #7A8C50
      [0.600, 0.620, 0.560], // muted sage #99A08F
      [0.420, 0.420, 0.380], // taupe #6B6B60
      [0.722, 0.706, 0.659], // warm grey #B8B4A8
    ]
    for (let i = 0; i < NODE_COUNT; i++) {
      const c = palette[Math.floor(Math.random() * palette.length)]
      cols[i * 3] = c[0]
      cols[i * 3 + 1] = c[1]
      cols[i * 3 + 2] = c[2]
    }
    return cols
  }, [])

  // Node sizes — varied
  const sizes = useMemo(() => {
    const s = new Float32Array(NODE_COUNT)
    for (let i = 0; i < NODE_COUNT; i++) {
      s[i] = 2 + Math.random() * 4
    }
    return s
  }, [])

  // Connection lines between nearby nodes
  const linePositions = useMemo(() => {
    const lines: number[] = []
    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const dx = positions[i * 3] - positions[j * 3]
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1]
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2]
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (dist < CONNECTION_DISTANCE) {
          lines.push(
            positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
            positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]
          )
        }
      }
    }
    return new Float32Array(lines)
  }, [positions])

  // Slow rotation
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15
      groupRef.current.rotation.x += delta * 0.05
    }
  })

  return (
    <group ref={groupRef}>
      {/* Connection lines */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#5A6B3A"
          transparent
          opacity={0.15}
        />
      </lineSegments>

      {/* Nodes */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
          />
          <bufferAttribute
            attach="attributes-size"
            args={[sizes, 1]}
          />
        </bufferGeometry>
        <pointsMaterial
          vertexColors
          size={0.06}
          sizeAttenuation
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </points>
    </group>
  )
}

export function KnowledgeSphere({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.5} />
        <Nodes />
      </Canvas>
    </div>
  )
}
