import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { RealityAnchor } from './RealityAnchor';
import { AtlasModule } from './ModuleLoader';
import { ScenarioRunner } from './ScenarioRunner';
import { InteractionSystem } from './InteractionSystem';

export class AtlasEngine {
    private static instance: AtlasEngine;

    // Core Three.js components
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;

    // Engine components
    public realityAnchor: RealityAnchor;
    public scenarioRunner: ScenarioRunner;
    public interactionSystem: InteractionSystem;

    // State
    private activeModule: AtlasModule | null = null;
    private clock: THREE.Clock;

    private constructor() {
        console.log('[AtlasEngine] Initializing...');

        // 1. Scene Setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x101010); // Dark grey background

        // 2. Camera Setup (Standard HMD FOV, will be overridden by WebXR)
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 1.6, 3); // Stand back 3m, eye height 1.6m

        // 3. Renderer Setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.xr.enabled = true; // ENABLE WEBXR

        // 4. DOM Injection
        document.body.appendChild(this.renderer.domElement);
        document.body.appendChild(VRButton.createButton(this.renderer));

        // 5. Lighting (Global defaults)
        const ambient = new THREE.AmbientLight(0x404040, 2); // Soft white light
        this.scene.add(ambient);
        const directional = new THREE.DirectionalLight(0xffffff, 1);
        directional.position.set(5, 10, 7);
        this.scene.add(directional);

        // 6. Reality Anchor (The Floor)
        this.realityAnchor = new RealityAnchor();
        this.scene.add(this.realityAnchor);

        // 7. Systems
        this.scenarioRunner = new ScenarioRunner();
        this.interactionSystem = new InteractionSystem(this.scene, this.scenarioRunner);
        this.interactionSystem.setupControllers(this.renderer);

        this.clock = new THREE.Clock();

        // 8. Event Listeners
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // 9. Start Loop
        this.renderer.setAnimationLoop(this.render.bind(this));

        console.log('[AtlasEngine] Ready.');
    }

    public static getInstance(): AtlasEngine {
        if (!AtlasEngine.instance) {
            AtlasEngine.instance = new AtlasEngine();
        }
        return AtlasEngine.instance;
    }

    /**
     * Load a module and unload the previous one.
     */
    public async loadModule(module: AtlasModule): Promise<void> {
        console.log(`[AtlasEngine] Loading module: ${module.id}`);

        if (this.activeModule) {
            console.log(`[AtlasEngine] Unloading: ${this.activeModule.id}`);
            this.activeModule.unload();
            this.activeModule = null;
        }

        // Clear listeners just in case
        this.scenarioRunner.clear();

        this.activeModule = module;
        await module.load(this.scene);

        console.log(`[AtlasEngine] Module ${module.id} loaded.`);
    }

    private render() {
        const dt = this.clock.getDelta();

        // Update active module
        if (this.activeModule) {
            this.activeModule.update(dt);

            // Interaction System Update
            if (this.activeModule.getInteractables) {
                this.interactionSystem.update(this.activeModule.getInteractables());
            }
        }

        this.renderer.render(this.scene, this.camera);
    }

    private onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
