import * as THREE from 'three';
import { AtlasModule } from '../../core/ModuleLoader';
import { AtlasEngine } from '../../core/AtlasEngine';
import { LogicNode, LogicType } from './LogicNode';
import { Wire } from './Wire';

export class ThemisModule implements AtlasModule {
    id = 'themis';
    private nodes: LogicNode[] = [];
    private wires: Wire[] = [];

    async load(scene: THREE.Scene): Promise<void> {
        console.log('[Themis] Loading Logic Engine...');

        // 1. Create Demo Circuit: (A AND B) -> C
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
        this.nodes.forEach(n => console.log(`[Themis] Node ${n.nodeId} at ${n.position.toArray()}`));

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
            console.error(`[Themis] Connect Fail: ${source.nodeId} has no output at ${outIdx}`);
            return;
        }
        if (!target.inputPorts[inIdx]) {
            console.error(`[Themis] Connect Fail: ${target.nodeId} has no input at ${inIdx}`);
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

        // Run Logic Simulation (Every frame for smoothness)
        this.simulate();
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
        const input1 = this.wires[0].getObjectByName('tubeMesh') ? stateA : false;
        // Wait, wires just carry visual. Logic is abstract.
        // Let's cheat for demo:
        const gateState = stateA && stateB;
        gate.setState(gateState);

        // 4. Output Wire
        this.wires[2].setActive(gateState);

        // 5. Sink Node
        this.nodes[3].setState(gateState);
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
