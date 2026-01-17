import * as THREE from 'three';

/**
 * The "Root" of the world content.
 * Manages the floor reference and ensures content is positioned comfortably relative to the user.
 */
export class RealityAnchor extends THREE.Group {
    private floorGrid: THREE.GridHelper;

    constructor() {
        super();
        this.name = 'RealityAnchor';

        // 1. Create a reference grid (Infinite floor feel)
        // 10x10 meters, 100 partitions (10cm lines)
        this.floorGrid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);

        // In WebXR, (0,0,0) is usually the floor if 'local-floor' reference space is used.
        // But visual feedback helps.
        this.add(this.floorGrid);

        // Optional: Add a subtle center marker
        const axes = new THREE.AxesHelper(0.5); // 50cm axes
        this.add(axes);
    }
}
