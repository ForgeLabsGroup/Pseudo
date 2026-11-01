'use client';
import type { LiveEvent } from '@pseudo/shared';
import { OrbitControls, Sparkles } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { onLive } from '@/lib/pulse-bus';
import {
  AGENT_LABEL,
  CORE_ID,
  EDGES,
  MODULE_LABEL,
  NODE_INDEX,
  NODES,
  agentId,
  findEdge,
  moduleId,
  resolveSource,
  type GraphAgent,
  type GraphModule,
} from './topology';

/** Scene palette, derived from the globals.css tokens (accent, link, danger) plus a cyan highlight. */
const COLORS = {
  bg: '#0a0a0a',
  accent: '#2b3bff',
  link: '#8f99ff',
  cyan: '#5ce1ff',
  danger: '#ff8a65',
  core: '#dfe3ff',
};

const MAX_PULSES = 128;
const TRAIL = 3;
const IDLE_AFTER_MS = 4000;
const IDLE_EVERY_MS = 1500;
const NODE_RADIUS = { core: 0.42, agent: 0.2, module: 0.16 } as const;
/** Screen-space gap between a node and its label, in px. */
const LABEL_GAP = { core: 56, agent: 16, module: 14 } as const;

/** DOM overlay elements the frame loop positions (plain refs, so no React roots inside the canvas). */
interface Overlay {
  labels: (HTMLDivElement | null)[];
  focus: HTMLDivElement | null;
}

interface Pulse {
  active: boolean;
  edge: number;
  reverse: boolean;
  t: number;
  speed: number;
  color: THREE.Color;
  size: number;
  /** Node index lit up on arrival, and by how much. */
  target: number;
  impact: number;
}

/** One provider call, shared by the agent's and the module's history lists. */
interface CallRecord {
  callId: string;
  agent: GraphAgent;
  module: GraphModule;
  label: string;
  at: number;
  ok?: boolean;
  ms?: number;
}

/** Everything the frame loop animates. Mutated in place by events; never React state. */
interface SceneState {
  heat: Float32Array;
  hold: Int16Array;
  flickerUntil: Float64Array;
  edgeHeat: Float32Array;
  pulses: Pulse[];
  nextPulse: number;
  lastEventAt: number;
  lastIdleAt: number;
  runs: Map<string, number>;
  calls: Map<string, number>;
  history: Map<string, CallRecord[]>;
}

const curves = EDGES.map(
  (e) =>
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...NODES[NODE_INDEX.get(e.from)!]!.position),
      new THREE.Vector3(...e.control),
      new THREE.Vector3(...NODES[NODE_INDEX.get(e.to)!]!.position),
    ),
);

function createState(): SceneState {
  const now = performance.now();
  return {
    heat: new Float32Array(NODES.length),
    hold: new Int16Array(NODES.length),
    flickerUntil: new Float64Array(NODES.length),
    edgeHeat: new Float32Array(EDGES.length),
    pulses: Array.from({ length: MAX_PULSES }, () => ({
      active: false,
      edge: 0,
      reverse: false,
      t: 0,
      speed: 1,
      color: new THREE.Color(),
      size: 1,
      target: 0,
      impact: 0,
    })),
    nextPulse: 0,
    lastEventAt: now - IDLE_AFTER_MS + 1200,
    lastIdleAt: 0,
    runs: new Map(),
    calls: new Map(),
    history: new Map(),
  };
}

function spawn(
  s: SceneState,
  edge: number,
  reverse: boolean,
  color: string,
  opts: { size?: number; speed?: number; intensity?: number; impact?: number } = {},
) {
  // Round-robin pool: when all are busy the oldest pulse is recycled.
  const p = s.pulses[s.nextPulse]!;
  s.nextPulse = (s.nextPulse + 1) % MAX_PULSES;
  const e = EDGES[edge]!;
  p.active = true;
  p.edge = edge;
  p.reverse = reverse;
  p.t = 0;
  p.speed = opts.speed ?? 0.9;
  p.size = opts.size ?? 1;
  p.color.set(color).multiplyScalar(opts.intensity ?? 3);
  p.target = NODE_INDEX.get(reverse ? e.from : e.to)!;
  p.impact = opts.impact ?? 1;
}

function send(
  s: SceneState,
  from: string,
  to: string,
  color: string,
  opts?: Parameters<typeof spawn>[4],
) {
  const hop = findEdge(from, to);
  if (hop) spawn(s, hop.index, hop.reverse, color, opts);
}

const bump = (s: SceneState, id: string, v: number) => {
  const i = NODE_INDEX.get(id)!;
  s.heat[i] = Math.max(s.heat[i]!, v);
};

function remember(s: SceneState, nodeId: string, rec: CallRecord) {
  const list = s.history.get(nodeId) ?? [];
  list.unshift(rec);
  s.history.set(nodeId, list.slice(0, 5));
}

/** Applies one live event to the scene. Returns the node ids whose history changed. */
function applyEvent(s: SceneState, e: LiveEvent): string[] {
  s.lastEventAt = performance.now();
  const src = resolveSource(e);
  const a = src ? agentId(src) : CORE_ID;
  switch (e.type) {
    case 'call.started': {
      const m = moduleId(e.module);
      const rec: CallRecord = {
        callId: e.callId,
        agent: src!,
        module: e.module,
        label: e.label,
        at: Date.now(),
      };
      send(s, a, m, COLORS.link);
      bump(s, a, 0.8);
      const mi = NODE_INDEX.get(m)!;
      s.hold[mi]!++;
      s.calls.set(e.callId, mi);
      remember(s, a, rec);
      remember(s, m, rec);
      return [a, m];
    }
    case 'call.finished': {
      const m = moduleId(e.module);
      const mi = s.calls.get(e.callId);
      if (mi !== undefined) {
        s.hold[mi] = Math.max(0, s.hold[mi]! - 1);
        s.calls.delete(e.callId);
      }
      send(s, m, a, e.ok ? COLORS.cyan : COLORS.danger, { intensity: 3.5 });
      const rec = s.history.get(m)?.find((r) => r.callId === e.callId);
      if (rec) Object.assign(rec, { ok: e.ok, ms: e.ms });
      return [a, m];
    }
    case 'run.started': {
      send(s, CORE_ID, a, COLORS.link, { size: 1.2 });
      const ai = NODE_INDEX.get(a)!;
      if (!s.runs.has(e.runId)) s.hold[ai]!++;
      s.runs.set(e.runId, ai);
      return [];
    }
    case 'run.progress': {
      const i = NODE_INDEX.get(a)!;
      s.flickerUntil[i] = performance.now() + 700;
      bump(s, a, 0.9);
      return [];
    }
    case 'run.succeeded':
    case 'run.failed': {
      const ai = s.runs.get(e.runId);
      if (ai !== undefined) {
        s.hold[ai] = Math.max(0, s.hold[ai]! - 1);
        s.runs.delete(e.runId);
      }
      send(s, a, CORE_ID, e.type === 'run.succeeded' ? COLORS.cyan : COLORS.danger, { size: 1.2 });
      return [];
    }
    // Each of these means a row was written: pulse into the Database node.
    case 'content.updated':
    case 'media.created':
    case 'persona.updated':
    case 'archetype.updated':
      send(s, a, moduleId('database'), COLORS.accent, { intensity: 4 });
      return [];
    case 'publish.updated':
      bump(s, a, 1);
      if (e.status === 'publishing') send(s, a, moduleId('publisher'), COLORS.link);
      return [];
    default:
      return [];
  }
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = (ev: MediaQueryListEvent) => setReduced(ev.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Keeps the whole sphere in view on narrow (portrait) screens. */
function FitCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    camera.position.setLength(aspect < 1 ? 11.5 / Math.max(aspect, 0.45) : 12);
  }, [camera, size]);
  return null;
}

function Graph({
  state: s,
  reduced,
  focused,
  onFocus,
  overlay,
}: {
  state: SceneState;
  reduced: boolean;
  focused: string | null;
  onFocus: (id: string) => void;
  overlay: Overlay;
}) {
  const nodeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const shellRef = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Group>(null);
  const ringB = useRef<THREE.Group>(null);
  const pulsesRef = useRef<THREE.InstancedMesh>(null);
  const controls = useThree((st) => st.controls) as unknown as { target: THREE.Vector3 } | null;

  const baseColors = useMemo(
    () =>
      NODES.map(
        (n) =>
          new THREE.Color(
            n.kind === 'core' ? COLORS.core : n.kind === 'agent' ? COLORS.link : COLORS.accent,
          ),
      ),
    [],
  );
  const lines = useMemo(
    () =>
      curves.map((c, i) => {
        const geom = new THREE.BufferGeometry().setFromPoints(c.getPoints(40));
        const mat = new THREE.LineBasicMaterial({
          color: EDGES[i]!.from === CORE_ID ? COLORS.link : COLORS.accent,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
          toneMapped: false,
        });
        return { line: new THREE.Line(geom, mat), base: mat.color.clone() };
      }),
    [],
  );
  const scratch = useMemo(
    () => ({
      obj: new THREE.Object3D(),
      color: new THREE.Color(),
      point: new THREE.Vector3(),
      target: new THREE.Vector3(),
      screen: new THREE.Vector3(),
    }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = pulsesRef.current;
    if (!mesh) return;
    scratch.obj.scale.setScalar(0);
    scratch.obj.updateMatrix();
    for (let i = 0; i < MAX_PULSES * TRAIL; i++) {
      mesh.setMatrixAt(i, scratch.obj.matrix);
      mesh.setColorAt(i, scratch.color.set(0, 0, 0));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [scratch]);

  useFrame((frame, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const now = performance.now();
    const time = frame.clock.elapsedTime;
    const spin = reduced ? 0.25 : 1;

    if (shellRef.current) shellRef.current.rotation.y += dt * 0.02 * spin;
    if (ringA.current) ringA.current.rotation.z += dt * 0.12 * spin;
    if (ringB.current) ringB.current.rotation.z -= dt * 0.08 * spin;

    // Idle ambience: a dim random pulse now and then so the core always feels alive.
    if (!reduced && now - s.lastEventAt > IDLE_AFTER_MS && now - s.lastIdleAt > IDLE_EVERY_MS) {
      s.lastIdleAt = now;
      const edge = Math.floor(Math.random() * EDGES.length);
      spawn(s, edge, Math.random() < 0.4, COLORS.link, {
        size: 0.6,
        speed: 0.45,
        intensity: 1.4,
        impact: 0.35,
      });
    }

    // Nodes: decaying heat, held high while a call or run is in flight.
    for (let i = 0; i < NODES.length; i++) {
      const mesh = nodeRefs.current[i];
      s.heat[i] = s.heat[i]! * Math.exp(-dt * 2.2);
      let glow = s.heat[i]!;
      if (s.hold[i]! > 0) glow = Math.max(glow, 0.7 + 0.25 * Math.sin(time * 6 + i));
      if (s.flickerUntil[i]! > now) glow *= 0.65 + Math.random() * 0.5;
      if (!mesh) continue;
      const kind = NODES[i]!.kind;
      const breathe = kind === 'core' ? 1 + 0.04 * Math.sin(time * 1.6) : 1;
      mesh.scale.setScalar(breathe * (1 + glow * 0.45));
      (mesh.material as THREE.MeshBasicMaterial).color
        .copy(baseColors[i]!)
        .multiplyScalar((kind === 'core' ? 0.75 : 0.9) + glow * 2.4);
    }

    // Pulses travel along their edge's bezier with a short fading trail.
    const mesh = pulsesRef.current;
    for (let k = 0; k < EDGES.length; k++) s.edgeHeat[k] = s.edgeHeat[k]! * Math.exp(-dt * 1.8);
    if (mesh) {
      for (let p = 0; p < MAX_PULSES; p++) {
        const pulse = s.pulses[p]!;
        if (pulse.active) {
          pulse.t += dt * pulse.speed;
          s.edgeHeat[pulse.edge] = Math.max(s.edgeHeat[pulse.edge]!, pulse.impact);
          if (pulse.t >= 1) {
            pulse.active = false;
            s.heat[pulse.target] = Math.max(s.heat[pulse.target]!, pulse.impact);
          }
        }
        for (let j = 0; j < TRAIL; j++) {
          const idx = p * TRAIL + j;
          const t = pulse.t - j * 0.035;
          if (!pulse.active || t < 0) {
            scratch.obj.scale.setScalar(0);
          } else {
            curves[pulse.edge]!.getPoint(pulse.reverse ? 1 - t : t, scratch.point);
            scratch.obj.position.copy(scratch.point);
            scratch.obj.scale.setScalar(0.06 * pulse.size * (1 - j * 0.28));
          }
          scratch.obj.updateMatrix();
          mesh.setMatrixAt(idx, scratch.obj.matrix);
          mesh.setColorAt(idx, scratch.color.copy(pulse.color).multiplyScalar(1 - j * 0.35));
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    for (let k = 0; k < lines.length; k++) {
      const { line, base } = lines[k]!;
      const mat = line.material as THREE.LineBasicMaterial;
      mat.opacity = 0.16 + s.edgeHeat[k]! * 0.6;
      mat.color.copy(base).multiplyScalar(1 + s.edgeHeat[k]! * 1.8);
    }

    // Ease the orbit target toward the focused node (or back to the centre).
    if (controls) {
      const pos = focused ? NODES[NODE_INDEX.get(focused)!]!.position : ([0, 0, 0] as const);
      scratch.target.set(pos[0], pos[1], pos[2]).multiplyScalar(0.6);
      controls.target.lerp(scratch.target, 0.06);
    }

    // Pin the DOM labels (and the focus card) to their nodes' screen positions.
    const { camera, size } = frame;
    for (let i = 0; i < NODES.length; i++) {
      const el = overlay.labels[i];
      if (!el) continue;
      const n = NODES[i]!;
      scratch.screen.set(...n.position).project(camera);
      const x = (scratch.screen.x * 0.5 + 0.5) * size.width;
      const y = (-scratch.screen.y * 0.5 + 0.5) * size.height;
      el.style.visibility = scratch.screen.z > 1 ? 'hidden' : 'visible';
      el.style.transform = `translate(${x}px, ${y - LABEL_GAP[n.kind]}px) translate(-50%, -100%)`;
      if (overlay.focus && n.id === focused)
        overlay.focus.style.transform = `translate(${x + 22}px, ${y}px) translate(0, -50%)`;
    }
  });

  return (
    <>
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[5.3, 2]} />
        <meshBasicMaterial
          color={COLORS.accent}
          wireframe
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>
      <group ref={ringA} rotation={[Math.PI / 2.3, 0.2, 0]}>
        <mesh>
          <torusGeometry args={[4.75, 0.008, 6, 180]} />
          <meshBasicMaterial color={COLORS.link} transparent opacity={0.35} toneMapped={false} />
        </mesh>
        <mesh position={[4.75, 0, 0]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshBasicMaterial color={COLORS.cyan} toneMapped={false} />
        </mesh>
      </group>
      <group ref={ringB} rotation={[Math.PI / 1.7, -0.5, 0]}>
        <mesh>
          <torusGeometry args={[5.0, 0.006, 6, 180]} />
          <meshBasicMaterial color={COLORS.accent} transparent opacity={0.4} toneMapped={false} />
        </mesh>
        <mesh position={[-5.0, 0, 0]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshBasicMaterial color={COLORS.link} toneMapped={false} />
        </mesh>
      </group>

      {lines.map(({ line }, i) => (
        <primitive key={EDGES[i]!.id} object={line} />
      ))}

      {NODES.map((n, i) => {
        const r = NODE_RADIUS[n.kind];
        return (
          <group key={n.id} position={n.position}>
            <mesh
              ref={(m) => {
                nodeRefs.current[i] = m;
              }}
              onClick={(ev) => {
                ev.stopPropagation();
                onFocus(n.id);
              }}
              onPointerOver={() => (document.body.style.cursor = 'pointer')}
              onPointerOut={() => (document.body.style.cursor = '')}
            >
              <sphereGeometry args={[r, 24, 24]} />
              <meshBasicMaterial toneMapped={false} />
            </mesh>
            {n.kind === 'core' && (
              <mesh>
                <sphereGeometry args={[r * 1.9, 20, 20]} />
                <meshBasicMaterial color={COLORS.link} wireframe transparent opacity={0.12} />
              </mesh>
            )}
          </group>
        );
      })}

      <instancedMesh
        ref={pulsesRef}
        args={[undefined, undefined, MAX_PULSES * TRAIL]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  );
}

function FocusCard({
  nodeId,
  label,
  kind,
  history,
}: {
  nodeId: string;
  label: string;
  kind: 'core' | 'agent' | 'module';
  history: CallRecord[];
}) {
  return (
    <div className="w-56 border border-border bg-surface/80 p-3 text-[12px] backdrop-blur">
      <div className="mono-label text-fg">{kind === 'core' ? 'You' : label}</div>
      <div className="mono-label mt-0.5 text-[10px] text-subtle">
        {kind === 'core' ? 'Core' : kind === 'agent' ? 'Agent' : 'Module'} · last calls
      </div>
      {history.length === 0 ? (
        <p className="mt-2 text-muted">No calls yet this session.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {history.slice(0, 4).map((r) => (
            <li key={r.callId} className="flex justify-between gap-2 font-mono text-[11px]">
              <span className="truncate text-muted">
                {nodeId.startsWith('agent:')
                  ? `→ ${MODULE_LABEL[r.module]} · ${r.label}`
                  : `${AGENT_LABEL[r.agent]} · ${r.label}`}
              </span>
              <span
                className={
                  r.ok === false ? 'text-danger' : r.ms === undefined ? 'text-link' : 'text-subtle'
                }
              >
                {r.ms === undefined ? '…' : `${r.ms}ms`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The live agent graph. Loaded client-only (next/dynamic) so three.js never ships to other pages. */
export default function CoreScene({ personaName }: { personaName: string | null }) {
  const state = useMemo(createState, []);
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const focusedRef = useRef<string | null>(null);
  focusedRef.current = focused;

  useEffect(
    () =>
      onLive((e) => {
        const touched = applyEvent(state, e);
        if (focusedRef.current && touched.includes(focusedRef.current))
          setHistoryVersion((v) => v + 1);
      }),
    [state],
  );

  useEffect(() => () => void (document.body.style.cursor = ''), []);

  const overlay = useRef<Overlay>({ labels: [], focus: null }).current;
  const focusedNode = focused ? NODES[NODE_INDEX.get(focused)!]! : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 2.4, 11.8], fov: 42 }}
        gl={{ antialias: true }}
        onPointerMissed={() => setFocused(null)}
        aria-label="Live agent graph"
      >
        <color attach="background" args={[COLORS.bg]} />
        <FitCamera />
        <Graph
          state={state}
          reduced={reduced}
          focused={focused}
          onFocus={setFocused}
          overlay={overlay}
        />
        <Sparkles
          count={70}
          scale={11}
          size={1.4}
          speed={reduced ? 0 : 0.15}
          opacity={0.35}
          color={COLORS.link}
        />
        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.06}
          autoRotate
          autoRotateSpeed={reduced ? 0.12 : 0.45}
          minDistance={6}
          maxDistance={22}
        />
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.2} luminanceSmoothing={0.3} />
        </EffectComposer>
      </Canvas>
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {NODES.map((n, i) => (
          <div
            key={n.id}
            ref={(el) => {
              overlay.labels[i] = el;
            }}
            className={`absolute left-0 top-0 hidden whitespace-nowrap text-center will-change-transform md:block ${n.id === focused ? 'text-fg' : 'text-muted'}`}
          >
            {n.kind === 'core' ? (
              <>
                <div className="text-sm text-fg">{personaName ?? 'Your alter ego'}</div>
                <div className="mono-label text-[10px] text-subtle">You</div>
              </>
            ) : (
              <span className="mono-label text-[10px]">{n.label}</span>
            )}
          </div>
        ))}
      </div>
      {focusedNode && (
        <div
          key={focusedNode.id}
          data-version={historyVersion}
          ref={(el) => {
            overlay.focus = el;
          }}
          className="pointer-events-none absolute left-0 top-0"
        >
          <FocusCard
            nodeId={focusedNode.id}
            label={focusedNode.label}
            kind={focusedNode.kind}
            history={state.history.get(focusedNode.id) ?? []}
          />
        </div>
      )}
    </div>
  );
}
