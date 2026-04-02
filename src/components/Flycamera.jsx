import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
// import './styles/flyCamera.css';

/**
 * FlyCamera
 *
 * Drop-in FPS-style camera controller for 3d-force-graph.
 * Runs its own requestAnimationFrame loop (independent of the d3-force
 * engine tick, which slows/stops as the simulation cools) so camera
 * input stays responsive at 60fps regardless of simulation state.
 *
 * Props:
 *   graphRef      — ref whose .current is the 3d-force-graph instance
 *   flyActiveRef  — ref shared with parent; FlyCamera writes .current
 *                   so the parent can gate click handlers (e.g. skip
 *                   onNodeClick while flying)
 *   containerRef  — ref to the wrapper div that contains the graph canvas;
 *                   used for requestPointerLock (available immediately,
 *                   unlike graph.renderer.domElement which is created later)
 */

// ── Tuning constants ──
const MOVE_SPEED  = 4.0;
const BOOST_MULT  = 3.0;
const LOOK_SPEED  = 0.002;   // radians per pixel
const PITCH_LIMIT = Math.PI / 2.2; // ±81°

export default function FlyCamera({ graphRef, flyActiveRef, containerRef }) {
  // Refs for the hot loop (never trigger re-renders)
  const keysRef          = useRef({});
  const eulerRef         = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const pointerLockedRef = useRef(false);
  const animIdRef        = useRef(null);

  // React state — only for HUD rendering
  const [active, setActive]               = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);

  // ── rAF camera loop ──
  const startLoop = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const camera = graph.camera();

    const tick = () => {
      if (!flyActiveRef.current) return;

      const keys = keysRef.current;

      // Direction vectors from current camera orientation
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward).normalize();

      const right = new THREE.Vector3();
      right.crossVectors(forward, camera.up).normalize();

      const up = new THREE.Vector3(0, 1, 0); // world-space vertical

      const speed = (keys['ShiftLeft'] || keys['ShiftRight'])
        ? MOVE_SPEED * BOOST_MULT
        : MOVE_SPEED;

      if (keys['KeyW']) camera.position.addScaledVector(forward, speed);
      if (keys['KeyS']) camera.position.addScaledVector(forward, -speed);
      if (keys['KeyA']) camera.position.addScaledVector(right, -speed);
      if (keys['KeyD']) camera.position.addScaledVector(right, speed);
      if (keys['KeyQ'] || keys['Space'])       camera.position.addScaledVector(up, speed);
      if (keys['KeyE'] || keys['ControlLeft']) camera.position.addScaledVector(up, -speed);

      camera.quaternion.setFromEuler(eulerRef.current);
      animIdRef.current = requestAnimationFrame(tick);
    };

    animIdRef.current = requestAnimationFrame(tick);
  }, [graphRef, flyActiveRef]);

  const stopLoop = useCallback(() => {
    if (animIdRef.current) {
      cancelAnimationFrame(animIdRef.current);
      animIdRef.current = null;
    }
  }, []);

  // ── Enable / disable fly mode ──
  const enable = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;

    flyActiveRef.current = true;
    setActive(true);

    // Snapshot current orientation so the view doesn't jump
    eulerRef.current.setFromQuaternion(graph.camera().quaternion, 'YXZ');

    // Disable orbit controls so they don't fight us
    const controls = graph.controls();
    if (controls) controls.enabled = false;

    startLoop();
  }, [graphRef, flyActiveRef, startLoop]);

  const disable = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;

    flyActiveRef.current = false;
    setActive(false);
    stopLoop();

    // Re-enable orbit controls
    const controls = graph.controls();
    if (controls) controls.enabled = true;

    if (document.pointerLockElement) document.exitPointerLock();
  }, [graphRef, flyActiveRef, stopLoop]);

  // ── Keyboard, mouse-look, pointer-lock listeners ──
  useEffect(() => {
    const onKeyDown = (e) => {
      keysRef.current[e.code] = true;
      if (e.code === 'Tab') {
        e.preventDefault();
        flyActiveRef.current ? disable() : enable();
      }
    };
    const onKeyUp = (e) => { keysRef.current[e.code] = false; };

    const onMouseMove = (e) => {
      if (!flyActiveRef.current || !pointerLockedRef.current) return;
      const euler = eulerRef.current;
      euler.y -= e.movementX * LOOK_SPEED;
      euler.x -= e.movementY * LOOK_SPEED;
      euler.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, euler.x));
    };

    const onPointerLockChange = () => {
      const locked = !!document.pointerLockElement;
      pointerLockedRef.current = locked;
      setPointerLocked(locked);
      // Esc releases pointer lock → also exit fly mode
      if (!locked && flyActiveRef.current) disable();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    return () => {
      stopLoop();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
  }, [enable, disable, flyActiveRef, stopLoop]);

  // ── Pointer lock: click container while in fly mode to capture mouse ──
  // Uses containerRef (the wrapper div rendered by GraphView) rather than
  // the Three.js canvas, because the canvas doesn't exist yet when this
  // effect first runs — graphRef.current is still null during mount.
  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;

    const onClick = () => {
      if (flyActiveRef.current && !pointerLockedRef.current) {
        el.requestPointerLock();
      }
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [containerRef, flyActiveRef]);

  // ── HUD overlay ──
  return (
    <>
      {/* Mode badge */}
      <div className="fly-hud fly-badge-group">
        <button
          className={`fly-badge ${active ? 'fly-badge--active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            flyActiveRef.current ? disable() : enable();
          }}
        >
          {active ? '✦ FLY MODE' : '◎ ORBIT MODE'}
        </button>
        <span className="fly-badge-hint">Tab to toggle</span>
      </div>

      {/* Controls legend */}
      {active && (
        <div className="fly-hud fly-controls">
          <div><kbd>W</kbd><kbd>S</kbd> forward / back</div>
          <div><kbd>A</kbd><kbd>D</kbd> strafe left / right</div>
          <div><kbd>Q</kbd><kbd>Space</kbd> ascend</div>
          <div><kbd>E</kbd><kbd>Ctrl</kbd> descend</div>
          <div><kbd>Shift</kbd> boost ×{BOOST_MULT}</div>
          <div><kbd>Mouse</kbd> look around</div>
          <div><kbd>Esc</kbd> exit fly mode</div>
        </div>
      )}

      {/* Pointer lock prompt */}
      {active && !pointerLocked && (
        <div className="fly-hud fly-lock-prompt">
          CLICK TO LOCK MOUSE
        </div>
      )}

      {/* Crosshair */}
      {active && pointerLocked && (
        <div className="fly-hud fly-crosshair">
          <span className="fly-crosshair-h" />
          <span className="fly-crosshair-v" />
        </div>
      )}
    </>
  );
}
