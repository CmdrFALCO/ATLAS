import { AtlasEngine } from './core/AtlasEngine';
import { AtlasModule } from './core/ModuleLoader';
import * as THREE from 'three';


// Temporary Test Module to verify the engine works
class TestModule implements AtlasModule {
    id = 'test-module';
    private cube: THREE.Mesh | null = null;

    async load(scene: THREE.Scene): Promise<void> {
        // Create a spinning cube
        const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        this.cube = new THREE.Mesh(geometry, material);
        this.cube.position.set(0, 1.5, -1); // 1.5m up, 1m in front
        scene.add(this.cube);

        // Listen for interactions
        AtlasEngine.getInstance().scenarioRunner.on('INTERACTION_HOVER', (data: any) => {
            if (this.cube && (this.cube.material as THREE.MeshStandardMaterial)) {
                if (data.object === this.cube) {
                    (this.cube.material as THREE.MeshStandardMaterial).color.set(0xff0000); // Red on hover
                } else {
                    (this.cube.material as THREE.MeshStandardMaterial).color.set(0x00ff00); // Green normal
                }
            }
        });
    }

    getInteractables(): THREE.Object3D[] {
        return this.cube ? [this.cube] : [];
    }

    update(dt: number): void {
        if (this.cube) {
            this.cube.rotation.x += dt;
            this.cube.rotation.y += dt;
        }
    }

    unload(): void {
        if (this.cube) {
            this.cube.removeFromParent();
            (this.cube.geometry as THREE.BufferGeometry).dispose();
            (this.cube.material as THREE.Material).dispose();
        }
    }
}

// Bootstrapping
const engine = AtlasEngine.getInstance();
const testModule = new TestModule();
engine.loadModule(testModule);
