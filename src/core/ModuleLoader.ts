import * as THREE from 'three';

/**
 * Standard interface that all Demo Modules (Mnemosyne, Themis, Tecton) must implement.
 */
export interface AtlasModule {
    id: string; // e.g., 'mnemosyne', 'themis'

    /**
     * Called when the module is initialized.
     * @param scene The main AtlasEngine scene to add objects to.
     */
    load(scene: THREE.Scene): Promise<void>;

    /**
     * Called every frame.
     * @param dt Delta time in seconds.
     */
    update(dt: number): void;

    /**
     * Called when switching away. Clean up all resources/objects here.
     */
    unload(): void;

    /**
     * strict list of objects to test against raycasting.
     */
    getInteractables?(): THREE.Object3D[];
}
