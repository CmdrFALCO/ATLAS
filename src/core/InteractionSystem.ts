import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { ScenarioRunner } from './ScenarioRunner';

export class InteractionSystem {
    private raycaster: THREE.Raycaster;
    private controllers: THREE.XRTargetRaySpace[] = [];
    private controllerGrips: THREE.XRGripSpace[] = [];

    // Visuals
    private tempMatrix = new THREE.Matrix4();
    private rayLines: THREE.Line[] = [];

    // State
    private hoveredObject: THREE.Object3D | null = null;

    constructor(private scene: THREE.Scene, private runner: ScenarioRunner) {
        this.raycaster = new THREE.Raycaster();
    }

    public setupControllers(renderer: THREE.WebGLRenderer) {
        const controllerModelFactory = new XRControllerModelFactory();

        // Setup Controller 0 and 1
        for (let i = 0; i < 2; i++) {
            // 1. Target Ray Space (The pointer)
            const controller = renderer.xr.getController(i);
            this.scene.add(controller);
            this.controllers.push(controller);

            // Visual Ray
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -5)
            ]);
            const line = new THREE.Line(geometry);
            line.name = 'line';
            line.scale.z = 5;
            controller.add(line);
            this.rayLines.push(line);

            // Events
            controller.addEventListener('selectstart', () => this.onSelectStart(i));
            controller.addEventListener('selectend', () => this.onSelectEnd(i));

            // 2. Grip Space (The visual representation of the hand/controller)
            const controllerGrip = renderer.xr.getControllerGrip(i);
            controllerGrip.add(controllerModelFactory.createControllerModel(controllerGrip));
            this.scene.add(controllerGrip);
            this.controllerGrips.push(controllerGrip);
        }
    }

    public update(interactables: THREE.Object3D[]) {
        if (!interactables || interactables.length === 0) return;

        // Use Controller 0 (Right hand usually) for main interaction for now, or check both
        this.checkIntersection(this.controllers[0], interactables);
        this.checkIntersection(this.controllers[1], interactables);
    }

    private checkIntersection(controller: THREE.XRTargetRaySpace, objects: THREE.Object3D[]) {
        if (!controller.userData.isSelecting) {
            // Only raycast for one controller at a time to avoid chaos, or both? 
            // For now, let's just make both raycast.
        }

        this.tempMatrix.identity().extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

        const intersects = this.raycaster.intersectObjects(objects, false); // False = no redundant recursive check if we pass nice flat list

        if (intersects.length > 0) {
            const object = intersects[0].object;
            if (this.hoveredObject !== object) {
                this.hoveredObject = object;
                this.runner.emit('INTERACTION_HOVER', { object });

                // Haptic feedback
                if ((controller as any).gamepad && (controller as any).gamepad.hapticActuators) {
                    (controller as any).gamepad.hapticActuators[0]?.pulse(0.1, 10);
                }
            }

            // Shorten ray to hit point
            const line = controller.getObjectByName('line');
            if (line) {
                line.scale.z = intersects[0].distance;
            }

        } else {
            if (this.hoveredObject) {
                this.runner.emit('INTERACTION_HOVER', { object: null });
                this.hoveredObject = null;
            }
            // Reset ray length
            const line = controller.getObjectByName('line');
            if (line) {
                line.scale.z = 5;
            }
        }
    }

    private onSelectStart(index: number) {
        const controller = this.controllers[index];
        controller.userData.isSelecting = true;

        if (this.hoveredObject) {
            this.runner.emit('INTERACTION_SELECT', { object: this.hoveredObject });
        }
    }

    private onSelectEnd(index: number) {
        const controller = this.controllers[index];
        controller.userData.isSelecting = false;
    }
}
