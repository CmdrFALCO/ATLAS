import * as THREE from 'three';
import ForceGraph3D from 'three-forcegraph';
import { AtlasModule } from '../../core/ModuleLoader';
import { VRCluster } from '../../shared/types';
import { AtlasEngine } from '../../core/AtlasEngine';
import { TrustPanel } from './TrustPanel';

export class MnemosyneModule implements AtlasModule {
    id = 'mnemosyne';
    private graph: any;
    private trustPanel: TrustPanel | null = null;
    private hoveredNode: THREE.Mesh | null = null;

    async load(scene: THREE.Scene): Promise<void> {
        console.log('[Mnemosyne] Loading...');

        // ... (Data Fetching - Unchanged) ...
        let data;
        try {
            const response = await fetch('/data/knowledge-graph.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            data = await response.json();
            console.log('[Mnemosyne] Data fetched:', data.nodes.length, 'nodes');
        } catch (e) {
            console.error('[Mnemosyne] Failed to load data:', e);
            return;
        }

        // ... (Graph Config - Unchanged) ...
        this.graph = (new ForceGraph3D() as any)
            .graphData(data)
            .nodeColor((node: any) => {
                const cluster = data.clusters.find((c: VRCluster) => c.id === node.clusterId);
                return cluster ? cluster.color : '#ffffff';
            })
            // Custom Sphere Geometry for connectivity
            .nodeThreeObject((node: any) => {
                const cluster = data.clusters.find((c: VRCluster) => c.id === node.clusterId);
                const color = cluster ? cluster.color : '#ffffff';

                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(20),
                    new THREE.MeshStandardMaterial({
                        color: color,
                        roughness: 0.7,
                        metalness: 0.2
                    })
                );
                // Store data on the mesh for retrieval
                sphere.userData = { ...node, isNode: true };
                return sphere;
            })
            .linkWidth((link: any) => link.type === 'ai_suggested' ? 1.5 : 1)
            .linkColor((link: any) => link.type === 'ai_suggested' ? '#ffffff' : '#555555')
            .linkDirectionalParticles((link: any) => link.type === 'ai_suggested' ? 4 : 0)
            .linkDirectionalParticleSpeed(0.005);

        this.graph.scale.set(0.002, 0.002, 0.002);
        this.graph.position.set(0, 1.5, -0.5);
        scene.add(this.graph);

        // UI: Trust Panel
        this.trustPanel = new TrustPanel();
        scene.add(this.trustPanel);

        // Setup Interaction
        this.setupInteractionHandlers();

        console.log('[Mnemosyne] Loaded.');
    }

    private setupInteractionHandlers() {
        const runner = AtlasEngine.getInstance().scenarioRunner;

        // HOVER
        runner.on('INTERACTION_HOVER', (payload: { object: THREE.Object3D | null }) => {
            // 1. Handle Unhover
            if (this.hoveredNode && this.hoveredNode !== payload.object) {
                if (this.hoveredNode.material instanceof THREE.MeshStandardMaterial) {
                    this.hoveredNode.material.emissive.set(0x000000);
                }
                this.hoveredNode = null;
            }

            // 2. Handle Hover
            if (payload.object) {
                // Check if it's a Node or a Button
                const obj = payload.object;

                if (obj.userData.isNode && obj instanceof THREE.Mesh) {
                    // Node Hover
                    if (obj.material instanceof THREE.MeshStandardMaterial) {
                        obj.material.emissive.set(0x333333);
                        this.hoveredNode = obj;
                    }
                } else if (obj.userData.type === 'button') {
                    // Button Hover (Handled visually by TrustPanel if we wanted, but simple log for now)
                    // console.log('Hovering Button:', obj.userData.id);
                }
            }
        });

        // SELECT (Click)
        runner.on('INTERACTION_SELECT', (payload: { object: THREE.Object3D }) => {
            const obj = payload.object;

            // Case A: Clicked a Node
            if (obj.userData.isNode) {
                console.log('Selected Node:', obj.userData.title);
                // Move Panel near node
                if (this.trustPanel) {
                    // Get world position of node
                    const worldPos = new THREE.Vector3();
                    obj.getWorldPosition(worldPos);

                    // Place panel slightly above/right
                    this.trustPanel.position.copy(worldPos).add(new THREE.Vector3(0.3, 0.2, 0));
                    this.trustPanel.lookAt(0, 1.6, 3); // Look at camera (approx)
                    this.trustPanel.show(obj.userData as any);
                }
            }

            // Case B: Clicked a UI Button
            else if (obj.userData.type === 'button') {
                console.log('Clicked Button:', obj.userData.id);
                // Simulate Decision
                if (this.trustPanel) {
                    this.trustPanel.hide();
                    // Could trigger graph update here
                }
            }
        });
    }

    update(_dt: number): void {
        if (this.graph) {
            this.graph.tickFrame();
        }
    }

    unload(): void {
        if (this.graph) this.graph.removeFromParent();
        if (this.trustPanel) this.trustPanel.removeFromParent();
    }

    getInteractables(): THREE.Object3D[] {
        const interactables: THREE.Object3D[] = [];

        // 1. Graph Nodes
        if (this.graph) {
            this.graph.traverse((child: any) => {
                if (child.isMesh && child.geometry.type === 'SphereGeometry') {
                    interactables.push(child);
                }
            });
        }

        // 2. UI Buttons
        if (this.trustPanel && this.trustPanel.visible) {
            interactables.push(this.trustPanel.btnAccept);
            interactables.push(this.trustPanel.btnReject);
        }

        return interactables;
    }
}
