
import * as THREE from 'three';
import { AtlasModule } from '../../core/ModuleLoader';
import { AtlasEngine } from '../../core/AtlasEngine';
import { LogicNode, LogicType } from './LogicNode';
import { Wire } from './Wire'; // Correctly imported
import { SubtitleOverlay } from './ui/SubtitleOverlay';
import { NarrativeManager } from './logic/NarrativeManager';

export class ThemisModule implements AtlasModule {
    id = 'themis';
    private nodes: LogicNode[] = [];
    private wires: Wire[] = [];
    private subtitles: SubtitleOverlay | null = null; // Add property
    private narrative: NarrativeManager;

    constructor() {
        this.narrative = new NarrativeManager();
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

        // 3. Create Demo Circuit (Legacy) - Kept as the "Puzzle"
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

        // DEBUG: Log Positions
        this.nodes.forEach(n => console.log(`[Themis] Node ${n.nodeId} at ${n.position.toArray()} `));

        // 2. Wiring
        this.connect(scene, nodeA, 0, nodeG, 0); // A -> G(in0)
        this.connect(scene, nodeB, 0, nodeG, 1); // B -> G(in1)
        this.connect(scene, nodeG, 0, nodeC, 0); // G -> C

        // 3. Setup Interaction
        this.setupInteraction();

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

        const wire = new Wire(start, end, source.nodeId, target.nodeId);
        scene.add(wire);
        this.wires.push(wire);
    }

    update(dt: number): void {
        // Run Animation
        this.wires.forEach(w => w.update(dt));

        // Update Subtitles
        if (this.subtitles) {
            this.subtitles.update(dt);
        }

        // Update Narrative
        this.narrative.update(dt);

        // Run Logic Simulation (Every frame for smoothness)
        this.simulate();
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
            console.log(`[Narrative] Spawned Agent ${data.id}`);
        });
    }

    private simulate() {
        if (this.wires.length < 3) return; // Prevent crash if wiring failed

        // Simple discrete simulation
        // 1. Evaluate Source Nodes (Manually toggled)
        const stateA = this.nodes[0].state;
        const stateB = this.nodes[1].state;

        // 2. Evaluate Wires (Pass state)
        // Wire 0: A -> G
        this.wires[0].setActive(stateA);
        // Wire 1: B -> G
        this.wires[1].setActive(stateB);

        // 3. Evaluate Gate (AND)
        const gate = this.nodes[2];
        // Wait, wires just carry visual. Logic is abstract.
        // Let's cheat for demo:
        const gateState = stateA && stateB;
        gate.setState(gateState);

        // 4. Output Wire
        this.wires[2].setActive(gateState);

        // 5. Sink Node
        this.nodes[3].setState(gateState);

        // Narrative Logic Check
        if (this.waitingForLogic && gateState === true) {
            console.log('[Themis] Puzzle Solved!');
            this.waitingForLogic = false;
            this.narrative.resume();
        }
    }

    private setupInteraction() {
        const runner = AtlasEngine.getInstance().scenarioRunner;

        runner.on('INTERACTION_SELECT', (payload: { object: THREE.Object3D }) => {
            const obj = payload.object;

            // Check if it's part of a Node
            // Traverse up to find parent LogicNode
            let current = obj;
            while (current.parent && !(current instanceof LogicNode)) {
                current = current.parent;
            }

            if (current instanceof LogicNode) {
                const node = current as LogicNode;
                // Toggle Source Nodes Only
                if (node.type === 'SOURCE') {
                    console.log('Toggling Node:', node.nodeId);
                    node.setState(!node.state);
                }
            }
        });
    }

    unload(): void {
        this.nodes.forEach(n => n.removeFromParent());
        this.wires.forEach(w => w.removeFromParent());
    }

    getInteractables(): THREE.Object3D[] {
        // Return mesh bodies for raycasting
        // We added userData to the body mesh in LogicNode
        const interactables: THREE.Object3D[] = [];
        this.nodes.forEach(n => {
            n.traverse(child => {
                if (child.userData.type === 'node') {
                    interactables.push(child);
                }
            });
        });
        return interactables;
    }
}
