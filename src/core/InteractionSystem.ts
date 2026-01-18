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

    // Mouse State
    private mouse = new THREE.Vector2();
    private camera: THREE.PerspectiveCamera | null = null;
    private isMouseInteraction = false;

    constructor(private scene: THREE.Scene, private runner: ScenarioRunner) {
        this.raycaster = new THREE.Raycaster();

        // Mouse Listeners
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            this.isMouseInteraction = true;
        });

        // Use click for select?
    }

    public setCamera(camera: THREE.PerspectiveCamera) {
        this.camera = camera;
    }

    public setupControllers(renderer: THREE.WebGLRenderer) {
        const controllerModelFactory = new XRControllerModelFactory();

        // Setup Controller 0 and 1
        for (let i = 0; i < 2; i++) {
            // 1. Target Ray Space (The pointer)
            const controller = renderer.xr.getController(i);
            this.scene.add(controller); // Ensure controller is added to scene!
            this.controllers.push(controller);
            controller.name = `controller_${i}`; // For debugging

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
            controller.addEventListener('squeezestart', () => this.onSqueezeStart(i));
            controller.addEventListener('squeezeend', () => this.onSqueezeEnd(i));

            // 2. Grip Space (The visual representation of the hand/controller)
            const controllerGrip = renderer.xr.getControllerGrip(i);
            controllerGrip.add(controllerModelFactory.createControllerModel(controllerGrip));
            this.scene.add(controllerGrip);
            this.controllerGrips.push(controllerGrip);
        }
    }

    public update(interactables: THREE.Object3D[]) {
        if (!interactables || interactables.length === 0) return;

        // Collect all potential hits
        let bestHit: { object: THREE.Object3D, distance: number, source: any } | null = null;

        // 1. Check VR Controllers
        for (const controller of this.controllers) {
            const hit = this.getControllerHit(controller, interactables);
            if (hit) {
                if (!bestHit || hit.distance < bestHit.distance) {
                    bestHit = { ...hit, source: controller };
                }
            } else {
                // Reset ray visual if no hit
                const line = controller.getObjectByName('line');
                if (line) line.scale.z = 5;
            }
        }

        // 2. Check Mouse
        if (this.camera && this.isMouseInteraction) {
            const hit = this.getMouseHit(interactables);
            if (hit) {
                if (!bestHit || hit.distance < bestHit.distance) {
                    bestHit = { ...hit, source: 'mouse' };
                }
            }
        }

        // 3. Process Best Hit
        if (bestHit) {
            const object = bestHit.object;

            // Visual Ray Update (VR only)
            if (bestHit.source !== 'mouse') {
                const line = bestHit.source.getObjectByName('line');
                if (line) line.scale.z = bestHit.distance;
            }

            // State Update
            if (this.hoveredObject !== object) {
                console.log('InteractionSystem: Hover', object);
                this.hoveredObject = object;
                this.runner.emit('INTERACTION_HOVER', { object });

                // Haptics (VR only)
                if (bestHit.source !== 'mouse') {
                    const controller = bestHit.source;
                    if ((controller as any).gamepad && (controller as any).gamepad.hapticActuators) {
                        (controller as any).gamepad.hapticActuators[0]?.pulse(0.1, 10);
                    }
                }
            }
        } else {
            // No hits from ANY source
            if (this.hoveredObject) {
                this.runner.emit('INTERACTION_HOVER', { object: null });
                this.hoveredObject = null;
            }
        }
    }

    private getMouseHit(objects: THREE.Object3D[]) {
        if (!this.camera) return null;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(objects, true);
        return intersects.length > 0 ? intersects[0] : null;
    }

    private getControllerHit(controller: THREE.XRTargetRaySpace, objects: THREE.Object3D[]) {
        this.tempMatrix.identity().extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

        // FIX: Sprites require raycaster.camera to be set
        if (this.camera) {
            this.raycaster.camera = this.camera;
        }

        const intersects = this.raycaster.intersectObjects(objects, true);
        return intersects.length > 0 ? intersects[0] : null;
    }


    private onSelectStart(index: number) {
        const controller = this.controllers[index];
        controller.userData.isSelecting = true;

        if (this.hoveredObject) {
            this.runner.emit('INTERACTION_SELECT', { object: this.hoveredObject, controller: controller });
        }
    }

    private onSelectEnd(index: number) {
        const controller = this.controllers[index];
        controller.userData.isSelecting = false;
    }

    private onSqueezeStart(index: number) {
        const controller = this.controllers[index];
        controller.userData.isSqueezing = true;

        if (this.hoveredObject) {
            // Traverse up to find the "Grabbable" root
            let current = this.hoveredObject;
            while (current.parent && !current.userData.grabbable) {
                if (current.parent.type === 'Scene') break;
                current = current.parent;
            }

            if (current.userData.grabbable) {
                console.log('Grabbed:', current.name);
                controller.attach(current); // Parenting while keeping world transform
                controller.userData.heldObject = current;
            }
        }
    }

    private onSqueezeEnd(index: number) {
        const controller = this.controllers[index];
        controller.userData.isSqueezing = false;

        if (controller.userData.heldObject) {
            console.log('Released:', controller.userData.heldObject.name);
            this.scene.attach(controller.userData.heldObject); // Return to world
            controller.userData.heldObject = null;
        }
    }
}
