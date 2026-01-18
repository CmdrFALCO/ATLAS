import * as THREE from 'three';
import { AtlasModule } from '../../core/ModuleLoader';
import { AtlasEngine } from '../../core/AtlasEngine';
import { LogicNode, LogicType } from './LogicNode';
import { Wire } from './Wire';
import { SubtitleOverlay } from './ui/SubtitleOverlay';
import { NarrativeManager } from './logic/NarrativeManager';
import { Synthesizer } from './audio/Synthesizer';

export class ThemisModule implements AtlasModule {
    id = 'themis';
    private nodes: LogicNode[] = [];
    private wires: Wire[] = [];
    private subtitles: SubtitleOverlay | null = null;
    private narrative: NarrativeManager;

    // Interaction State
    private hoveredPort: THREE.Mesh | null = null;

    // Draft Wire Interaction
    private draftWire: Wire | null = null;
    private draftController: THREE.XRTargetRaySpace | null = null;

    // UI
    private systemMenu: THREE.Group | null = null;
    private uiPanel: THREE.Mesh | null = null; // Track directly because parent changes on Grab

    private audio: Synthesizer;

    constructor() {
        this.narrative = new NarrativeManager();
        this.audio = new Synthesizer();
        this.narrative.on('LOGIC_CHECK', () => {
            console.log('[Narrative] Waiting for Logic...');
            this.narrative.pause();
            this.waitingForLogic = true;
        });
    }

    // Need to store scene reference
    private scene: THREE.Scene | null = null;
    private waitingForLogic: boolean = false;

    async load(scene: THREE.Scene): Promise<void> {
        this.scene = scene;
        console.log('[Themis] Loading Logic Engine...');

        // 0. Setup UI (Subtitles)
        this.subtitles = new SubtitleOverlay();
        this.subtitles.position.set(0, 1.2, -1.5); // Slightly above nodes
        scene.add(this.subtitles);

        // 1. Setup Narrative Handlers
        this.setupNarrative();

        // 2. Start Narrative Script (Act 1 & 2)
        this.narrative.startScript([
            // ACT 1: Intro
            { type: 'SHOW_SUBTITLE', payload: 'BOOT SEQUENCE INITIATED...' },
            { type: 'WAIT', payload: 3 },
            { type: 'SPAWN_AGENT', payload: { id: 'agent_mnemosyne', type: 'AND', pos: [-1.0, 1.5, -1.5] } },
            { type: 'SHOW_SUBTITLE', payload: 'MNEMOSYNE: Memory Banks Online.' },
            { type: 'WAIT', payload: 3 },
            { type: 'SPAWN_AGENT', payload: { id: 'agent_themis', type: 'NOT', pos: [1.0, 1.5, -1.5] } },
            { type: 'SHOW_SUBTITLE', payload: 'THEMIS: Logic Circuits Calibrated.' },
            { type: 'WAIT', payload: 3 },
            { type: 'SHOW_SUBTITLE', payload: 'ATLAS: System Nominal.' },
            { type: 'WAIT', payload: 2 },

            // ACT 2: The Conflict
            { type: 'SHOW_SUBTITLE', payload: 'MNEMOSYNE: Wait. I have found a fragmented memory.' },
            { type: 'WAIT', payload: 4 },
            { type: 'SHOW_SUBTITLE', payload: 'THEMIS: Inspecting... Logic Check Failed.' },
            { type: 'WAIT', payload: 3 },
            { type: 'SHOW_SUBTITLE', payload: 'THEMIS: The circuit is incomplete. Truth cannot flow.' },
            { type: 'WAIT', payload: 4 },
            { type: 'SHOW_SUBTITLE', payload: 'ATLAS: User intervention required. Enable the circuit.' },

            // Logic Puzzle
            { type: 'LOGIC_CHECK' },

            // ACT 3: Resolution
            { type: 'SHOW_SUBTITLE', payload: 'THEMIS: Logic Restored. Truth validated.' },
            { type: 'WAIT', payload: 3 },
            { type: 'SHOW_SUBTITLE', payload: 'MNEMOSYNE: The memory is safe.' },
            { type: 'WAIT', payload: 3 },
            { type: 'SHOW_SUBTITLE', payload: 'ATLAS: Simulation Complete.' }
        ]);

        // 3. Create Demo Circuit (Legacy) & WP-10 Playground
        this.restoreDefault();

        // 3. Setup Interaction
        this.setupInteraction();

        // 4. VR System Menu (WP-11)
        this.createSystemMenu();

        console.log('[Themis] Loaded.');
    }

    private connect(scene: THREE.Scene, source: LogicNode, outIdx: number, target: LogicNode, inIdx: number) {
        if (!source.outputPorts[outIdx]) {
            console.error(`[Themis] Connect Fail: ${source.nodeId} has no output at ${outIdx} `);
            return;
        }
        if (!target.inputPorts[inIdx]) {
            console.error(`[Themis] Connect Fail: ${target.nodeId} has no input at ${inIdx} `);
            return;
        }

        // Calculate World Pos
        const start = source.position.clone().add(source.outputPorts[outIdx].position);
        const end = target.position.clone().add(target.inputPorts[inIdx].position);

        const sourcePortId = `${source.nodeId}_out_${outIdx}`;
        const targetPortId = `${target.nodeId}_in_${inIdx}`;

        const wire = new Wire(start, end, sourcePortId, targetPortId);
        scene.add(wire);
        this.wires.push(wire);
    }

    update(dt: number): void {
        this.nodes.forEach(n => n.update(dt));

        // Run Animation & Position Updates
        this.wires.forEach(w => {
            w.update(dt);

            // WP-09: Update Wire Positions (if not draft)
            if (w.sourceId !== 'cursor' && w.targetId !== 'cursor') {
                const start = this.getPortGlobalPosition(w.sourceId);
                const end = this.getPortGlobalPosition(w.targetId);
                w.updatePositions(start, end);
            }
        });

        // Update Subtitles
        if (this.subtitles) {
            this.subtitles.update(dt);
        }

        // Update Narrative
        this.narrative.update(dt);

        // Run Logic Simulation (Every frame for smoothness)
        this.simulate();

        // Update Draft Wire
        if (this.draftWire && this.draftController) {
            const targetPos = new THREE.Vector3();
            this.draftController.getWorldPosition(targetPos);
            targetPos.z -= 0.05; // Tip offset
            this.draftWire.updateTarget(targetPos);
        }
    }

    private setupNarrative() {
        this.narrative.on('SHOW_SUBTITLE', (e) => {
            if (this.subtitles) {
                this.subtitles.show(e.payload as string);
            }
        });

        this.narrative.on('SPAWN_AGENT', (e) => {
            const data = e.payload as { id: string, type: LogicType, pos: number[] };
            const pos = new THREE.Vector3().fromArray(data.pos);
            const node = new LogicNode(data.id, data.type, pos);
            this.scene!.add(node); // Need scene reference!
            this.nodes.push(node);
            this.nodeMap.set(node.nodeId, node);
            console.log(`[Narrative] Spawned Agent ${data.id}`);
        });
    }

    // Generic Logic Engine State
    private nodeMap: Map<string, LogicNode> = new Map();

    private simulate() {
        // 1. Reset Inputs (Default low)
        this.nodes.forEach(n => n.inputs = []);

        // 2. Propagate Signals via Wires
        this.wires.forEach(w => {
            // Skip Draft Wires
            if (w.sourceId === 'cursor' || w.targetId === 'cursor') return;

            // Parse IDs: nodeId_type_index
            const src = this.parsePortId(w.sourceId);
            const tgt = this.parsePortId(w.targetId);

            const srcNode = this.nodeMap.get(src.nodeId);
            const tgtNode = this.nodeMap.get(tgt.nodeId);

            if (srcNode && tgtNode) {
                // Get Source State
                // If it's an output port, it carries the node's main state (usually).
                const signal = srcNode.state;

                // Deliver to Target Input
                if (tgt.isInput) {
                    tgtNode.inputs[tgt.index] = signal;
                }

                // Update Wire Visuals
                w.setActive(signal);
            }
        });

        // 3. Compute Node States
        let puzzleSolved = false;
        this.nodes.forEach(n => {
            n.compute();

            // Generic puzzle check (For Node C being True)
            if (n.nodeId === 'node_C' && n.state === true) {
                puzzleSolved = true;
            }
        });

        // 4. Narrative Trigger
        if (this.waitingForLogic && puzzleSolved) {
            console.log('[Themis] Puzzle Solved!');
            this.waitingForLogic = false;
            this.narrative.resume();
        }
    }

    private parsePortId(portId: string) {
        // Format: nodeId_in_index or nodeId_out_index
        const parts = portId.split('_');
        const index = parseInt(parts.pop()!);
        const type = parts.pop(); // 'in' or 'out'
        const nodeId = parts.join('_');
        return { nodeId, index, isInput: type === 'in' };
    }

    private setupInteraction() {
        const runner = AtlasEngine.getInstance().scenarioRunner;

        // Keyboard Shortcuts (Debug)
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 's') this.save();
            if (e.key.toLowerCase() === 'l') this.loadCircuit();
        });

        // Hover Feedback
        runner.on('INTERACTION_HOVER', (payload: { object: THREE.Object3D | null }) => {
            const obj = payload.object;
            // Clear previous highlights? 
            // Better: InteractionSystem handles entering/leaving state. 
            // Simple approach: Scale up the hovered port.
            // But we need to scale down the PREVIOUS one.
            // Actually, InteractionSystem sends { object: null } when leaving.

            // Check if it's a port
            if (obj && obj.userData.type === 'port') {
                obj.scale.set(1.5, 1.5, 1.5);
                const mesh = obj as THREE.Mesh;
                if (!Array.isArray(mesh.material)) {
                    mesh.material = mesh.material.clone();
                    (mesh.material as THREE.MeshStandardMaterial).color.set(0xffff00);
                }
            } else {
                // How to reset?
                // ThemisModule doesn't track "currently hovered port" to un-hover it.
                // InteractionSystem only tells us what IS hovered. 
                // We should iterate all ports and reset them? Expensive.
                // Or store `hoveredPort` in ThemisModule.

                if (this.hoveredPort) {
                    this.hoveredPort.scale.set(1, 1, 1);
                    (this.hoveredPort.material as THREE.MeshStandardMaterial).color.set(0xaaaaaa);
                    this.hoveredPort = null;
                }
            }

            if (obj && obj.userData.type === 'port') {
                this.hoveredPort = obj as THREE.Mesh;
            }
        });

        runner.on('INTERACTION_SELECT', (payload: { object: THREE.Object3D, controller: THREE.XRTargetRaySpace }) => {
            const obj = payload.object;
            const controller = payload.controller;

            // 1. Check for Port interaction (Wiring)
            if (obj.userData.type === 'port') {
                const portId = obj.userData.id;

                if (this.draftWire) {
                    // Completing a wire?
                    if (this.isValidConnection(this.draftWire.sourceId, portId)) {
                        console.log('Connecting:', this.draftWire.sourceId, '->', portId);

                        // Determine Source/Target relationship for Wire constructor
                        let trueSourceId = this.draftWire.sourceId;
                        let trueTargetId = portId;

                        // Wire logic assumes flow Source -> Target.
                        if (trueSourceId.includes('_in_')) {
                            // Swap
                            const temp = trueSourceId;
                            trueSourceId = trueTargetId;
                            trueTargetId = temp;
                        }

                        // Strict Rule: Single Input
                        // If trueTargetId is an Input port, remove any existing wire to it.
                        if (trueTargetId.includes('_in_')) {
                            this.removeWireConnectedTo(trueTargetId);
                        }

                        // Re-fetch clean positions (Draft wire used cursor for one end)
                        const pStart = this.getPortGlobalPosition(trueSourceId);
                        const pEnd = this.getPortGlobalPosition(trueTargetId);

                        const wire = new Wire(pStart, pEnd, trueSourceId, trueTargetId);
                        wire.setActive(true);
                        this.scene?.add(wire);
                        this.wires.push(wire);

                        this.audio.playConnect(); // Audio Feedback
                        this.destroyDraftWire();
                    } else {
                        console.log('Invalid Connection');
                        this.destroyDraftWire();
                    }
                } else {
                    // Start new Draft Wire OR Disconnect existing?

                    // Interaction: Click Input Port with existing wire -> Disconnect
                    if (portId.includes('_in_') && this.hasWire(portId)) {
                        console.log('Disconnecting Input:', portId);
                        this.removeWireConnectedTo(portId);
                        return; // Don't start draft
                    }

                    // Interaction: Start Draft
                    console.log('Start Draft Wire from', portId);
                    const sourcePos = new THREE.Vector3();
                    obj.getWorldPosition(sourcePos);

                    // temporary target is same as source
                    this.draftWire = new Wire(sourcePos, sourcePos, portId, 'cursor');
                    this.scene?.add(this.draftWire);
                    this.draftController = controller;
                }
                return;
            }

            // 2. Click LogicNode (Source Toggle)
            let current = obj;
            while (current.parent && !(current instanceof LogicNode)) {
                current = current.parent;
            }

            if (current instanceof LogicNode) {
                const node = current as LogicNode;
                // If we also cancel draft wire on node click?
                if (this.draftWire) {
                    this.destroyDraftWire();
                    return;
                }

                if (node.type === 'SOURCE') {
                    console.log('Toggling Node:', node.nodeId);
                    node.setState(!node.state);
                    this.audio.playClick(); // Audio Feedback
                }
            } else {
                // Check for System Menu Button (Crawl up hierarchy)
                let btn = obj;
                while (btn.parent && btn.userData.type !== 'button') {
                    btn = btn.parent;
                    if (btn instanceof THREE.Scene) break; // Safety
                }

                if (btn.userData.type === 'button') {
                    // 3. System Menu Buttons
                    const action = btn.userData.action;
                    console.log('[Themis] Button Click:', action);
                    this.audio.playClick(); // Audio Feedback

                    // Visual Feedback (Pulse)
                    const originalScale = btn.scale.clone();
                    btn.scale.multiplyScalar(0.9);
                    setTimeout(() => btn.scale.copy(originalScale), 150);

                    if (action === 'save') this.save();
                    if (action === 'load') this.loadCircuit();
                    if (action === 'clear') this.restoreDefault();
                } else {
                    // Clicked empty space?
                    if (this.draftWire) {
                        this.destroyDraftWire();
                    }
                }
            }
        });
    }

    private createSystemMenu() {
        const menuGroup = new THREE.Group();
        menuGroup.position.set(-0.8, 1.2, -0.5); // Left side, accessible
        menuGroup.rotation.y = Math.PI / 4; // Face user

        // Panel Background
        const panelGeo = new THREE.BoxGeometry(0.5, 0.6, 0.05);
        const panelMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const panel = new THREE.Mesh(panelGeo, panelMat);
        // Enable Grabbing
        panel.userData = { type: 'ui_panel', grabbable: true };
        menuGroup.add(panel);

        // Label
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#333333'; ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = 'white'; ctx.font = '40px Arial'; ctx.textAlign = 'center';
        ctx.fillText('SYSTEM', 128, 45);
        const tex = new THREE.CanvasTexture(canvas);
        const label = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshBasicMaterial({ map: tex }));
        label.position.set(0, 0.22, 0.03);
        panel.add(label);

        // Helper to create button
        const createBtn = (text: string, color: number, y: number, action: string) => {
            const btnGeo = new THREE.BoxGeometry(0.3, 0.1, 0.05);
            const btnMat = new THREE.MeshStandardMaterial({ color });
            const btn = new THREE.Mesh(btnGeo, btnMat);
            btn.position.set(0, y, 0.03);
            btn.userData = { type: 'button', action };

            // Text
            const c = document.createElement('canvas');
            c.width = 256; c.height = 64;
            const cx = c.getContext('2d')!;
            cx.fillStyle = 'rgba(0,0,0,0)'; cx.fillRect(0, 0, 256, 64); // Transp
            cx.fillStyle = 'white'; cx.font = 'bold 40px Arial'; cx.textAlign = 'center';
            cx.fillText(text, 128, 45);
            const t = new THREE.CanvasTexture(c);
            const l = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.08), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
            l.position.z = 0.04; // On top of button
            btn.add(l);

            return btn;
        };

        const btnSave = createBtn('SAVE', 0x228822, 0.1, 'save');
        panel.add(btnSave);

        const btnLoad = createBtn('LOAD', 0x224488, -0.05, 'load');
        panel.add(btnLoad);

        const btnClear = createBtn('CLEAR', 0x882222, -0.2, 'clear');
        panel.add(btnClear);

        this.scene?.add(menuGroup);
        this.systemMenu = menuGroup;
        this.uiPanel = panel;
    }

    private hasWire(portId: string): boolean {
        return this.wires.some(w => w.sourceId === portId || w.targetId === portId);
    }

    private removeWireConnectedTo(portId: string) {
        // Find wire
        const index = this.wires.findIndex(w => w.sourceId === portId || w.targetId === portId);
        if (index !== -1) {
            const wire = this.wires[index];
            wire.removeFromParent();
            this.wires.splice(index, 1);
            console.log('Removed Wire:', wire.sourceId, '->', wire.targetId);
            this.audio.playDisconnect();
        }
    }

    private destroyDraftWire() {
        if (this.draftWire) {
            this.draftWire.removeFromParent();
            this.draftWire = null;
        }
        this.draftController = null;
    }

    private isValidConnection(idA: string, idB: string): boolean {
        // Prevent self
        if (idA === idB) return false;

        // Must be Input <-> Output
        const aInput = idA.includes('_in_');
        const bInput = idB.includes('_in_');

        if (aInput === bInput) return false; // Output-Output or Input-Input invalid

        // Check parent node (Prevent self-loop on same node?)
        // IDs: nodeID_in_X
        // Extract Node ID... regex or split
        const nodeA = idA.split('_').slice(0, -2).join('_');
        const nodeB = idB.split('_').slice(0, -2).join('_'); // Simplistic

        if (nodeA === nodeB) return false; // Cannot wire node to itself directly

        return true;
    }

    private getPortGlobalPosition(portId: string): THREE.Vector3 {
        let pos = new THREE.Vector3();
        // Search nodes
        for (const node of this.nodes) {
            // Check inputs
            const inPort = node.inputPorts.find(p => p.userData.id === portId);
            if (inPort) {
                inPort.getWorldPosition(pos);
                return pos;
            }
            // Check outputs
            const outPort = node.outputPorts.find(p => p.userData.id === portId);
            if (outPort) {
                outPort.getWorldPosition(pos);
                return pos;
            }
        }
        return pos;
    }

    unload(): void {
        this.resetCircuit();
        if (this.systemMenu) {
            this.systemMenu.removeFromParent();
            this.systemMenu = null;
        }
        if (this.uiPanel) {
            this.uiPanel.removeFromParent(); // Just in case it was detached
            this.uiPanel = null;
        }
    }

    private restoreDefault() {
        console.log('[Themis] Restoring Default Circuit...');
        this.resetCircuit();

        const scene = this.scene;
        if (!scene) return;

        // Node A (Source 1)
        const nodeA = new LogicNode('node_A', 'SOURCE', new THREE.Vector3(-0.5, 1.6, -1));
        scene.add(nodeA);
        this.nodes.push(nodeA);

        // Node B (Source 2)
        const nodeB = new LogicNode('node_B', 'SOURCE', new THREE.Vector3(-0.5, 1.3, -1));
        scene.add(nodeB);
        this.nodes.push(nodeB);

        // Node G (Gate AND)
        const nodeG = new LogicNode('node_G', 'AND', new THREE.Vector3(0, 1.45, -1));
        scene.add(nodeG);
        this.nodes.push(nodeG);

        // Node C (Output)
        const nodeC = new LogicNode('node_C', 'SINK', new THREE.Vector3(0.5, 1.45, -1));
        scene.add(nodeC);
        this.nodes.push(nodeC);

        // WP-10 Playground: Advanced Nodes
        const nodeTimer = new LogicNode('node_Timer', 'TIMER', new THREE.Vector3(1.2, 1.6, -1));
        scene.add(nodeTimer);
        this.nodes.push(nodeTimer);

        const nodeToggle = new LogicNode('node_Toggle', 'TOGGLE', new THREE.Vector3(1.2, 1.3, -1));
        scene.add(nodeToggle);
        this.nodes.push(nodeToggle);

        const nodeCounter = new LogicNode('node_Counter', 'COUNTER', new THREE.Vector3(1.2, 1.0, -1));
        scene.add(nodeCounter);
        this.nodes.push(nodeCounter);

        // Map initial nodes
        this.nodes.forEach(n => this.nodeMap.set(n.nodeId, n));

        // Wiring
        this.connect(scene, nodeA, 0, nodeG, 0); // A -> G(in0)
        this.connect(scene, nodeB, 0, nodeG, 1); // B -> G(in1)
        this.connect(scene, nodeG, 0, nodeC, 0); // G -> C

        if (this.subtitles) this.subtitles.show('Circuit Reset.');
    }

    private resetCircuit() {
        this.nodes.forEach(n => n.removeFromParent());
        this.wires.forEach(w => w.removeFromParent());
        this.nodes = [];
        this.wires = [];
        this.nodeMap.clear();
        this.destroyDraftWire();
    }

    getInteractables(): THREE.Object3D[] {
        const interactables: THREE.Object3D[] = [];
        this.nodes.forEach(n => {
            n.traverse(child => {
                // Include Nodes AND Ports
                if (child.userData.type === 'node' || child.userData.type === 'port') {
                    interactables.push(child);
                }
            });
        });

        // Include System Menu (Track Panel directly as it might change parents)
        if (this.uiPanel) {
            // Include the panel itself
            interactables.push(this.uiPanel);

            // Include children (Buttons)
            this.uiPanel.traverse(child => {
                if (child.userData.type === 'button') {
                    interactables.push(child);
                }
            });
        }

        return interactables;
    }

    // Persistence
    private save() {
        const data: CircuitData = {
            version: 1,
            nodes: this.nodes.map(n => ({
                id: n.nodeId,
                type: n.type,
                position: n.position.toArray(),
                data: n.data
            })),
            wires: this.wires
                .filter(w => w.sourceId !== 'cursor' && w.targetId !== 'cursor')
                .map(w => ({
                    sourceId: w.sourceId,
                    targetId: w.targetId
                }))
        };

        const json = JSON.stringify(data);
        localStorage.setItem('atlas_circuit', json);
        console.log('[Themis] Saved Circuit:', data);
        if (this.subtitles) this.subtitles.show('Circuit Saved.');
    }

    private loadCircuit() {
        const json = localStorage.getItem('atlas_circuit');
        if (!json) {
            console.warn('[Themis] No saved circuit found.');
            if (this.subtitles) this.subtitles.show('No Save Found.');
            return;
        }

        try {
            const data: CircuitData = JSON.parse(json);
            console.log('[Themis] Loading Circuit...', data);

            console.log('[Themis] Loading Circuit...', data);

            // 1. Clear Scene
            this.resetCircuit();
            this.nodes = [];
            this.wires = [];
            this.nodeMap.clear();

            // 2. Recreate Nodes
            data.nodes.forEach(nData => {
                const pos = new THREE.Vector3().fromArray(nData.position);
                const node = new LogicNode(nData.id, nData.type, pos);
                if (nData.data) node.data = nData.data;

                this.scene?.add(node);
                this.nodes.push(node);
                this.nodeMap.set(node.nodeId, node);
            });

            // 3. Recreate Wires
            data.wires.forEach(wData => {
                // We need to find the specific ports to get positions
                // Parse Logic
                const src = this.parsePortId(wData.sourceId);
                const tgt = this.parsePortId(wData.targetId);

                const srcNode = this.nodeMap.get(src.nodeId);
                const tgtNode = this.nodeMap.get(tgt.nodeId);

                if (srcNode && tgtNode) {
                    // Validate ports exist?
                    const start = this.getPortGlobalPosition(wData.sourceId);
                    const end = this.getPortGlobalPosition(wData.targetId);

                    const wire = new Wire(start, end, wData.sourceId, wData.targetId);
                    wire.setActive(true);
                    this.scene?.add(wire);
                    this.wires.push(wire);
                }
            });

            console.log('[Themis] Load Complete.');
            if (this.subtitles) this.subtitles.show('Circuit Loaded.');

        } catch (e) {
            console.error('[Themis] Load Failed:', e);
            if (this.subtitles) this.subtitles.show('Load Failed.');
        }
    }
}

interface CircuitData {
    version: number;
    nodes: Array<{
        id: string;
        type: LogicType;
        position: number[];
        data: any;
    }>;
    wires: Array<{
        sourceId: string;
        targetId: string;
    }>;
}
