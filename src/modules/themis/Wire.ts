import * as THREE from 'three';

export class Wire extends THREE.Group {
    public sourceId: string;
    public targetId: string;

    private curve: THREE.CatmullRomCurve3;
    private tubeMesh: THREE.Mesh;
    private tokens: THREE.Mesh[] = [];

    // Animation State
    private isActive: boolean = false;
    private spawnTimer: number = 0;

    constructor(sourcePos: THREE.Vector3, targetPos: THREE.Vector3, sourceId: string, targetId: string) {
        super();
        this.sourceId = sourceId;
        this.targetId = targetId;

        // 1. Calculate Bezier points
        // Control points to make it curve nicely (curving out horizontally)
        const p1 = sourcePos.clone();
        const p4 = targetPos.clone();

        // P2 and P3 are control points
        const dist = p1.distanceTo(p4);
        const p2 = p1.clone().add(new THREE.Vector3(dist * 0.5, 0, 0)); // Right from source
        const p3 = p4.clone().add(new THREE.Vector3(-dist * 0.5, 0, 0)); // Left from target

        this.curve = new THREE.CatmullRomCurve3([p1, p2, p3, p4]);

        // 2. Visual Tube
        const geometry = new THREE.TubeGeometry(this.curve, 20, 0.005, 8, false);
        const material = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.5 });
        this.tubeMesh = new THREE.Mesh(geometry, material);
        this.add(this.tubeMesh);
    }

    public setActive(active: boolean) {
        this.isActive = active;
        if (active) {
            (this.tubeMesh.material as THREE.MeshBasicMaterial).color.set(0x00aaff);
            (this.tubeMesh.material as THREE.MeshBasicMaterial).opacity = 1;
        } else {
            (this.tubeMesh.material as THREE.MeshBasicMaterial).color.set(0x555555);
            (this.tubeMesh.material as THREE.MeshBasicMaterial).opacity = 0.5;
            // Clear tokens
            this.tokens.forEach(t => t.removeFromParent());
            this.tokens = [];
        }
    }

    public update(dt: number) {
        if (!this.isActive) return;

        // 1. Spawn Tokens
        this.spawnTimer += dt;
        if (this.spawnTimer > 1.0) { // Spawn every 1s
            this.spawnToken();
            this.spawnTimer = 0;
        }

        // 2. Move Tokens
        for (let i = this.tokens.length - 1; i >= 0; i--) {
            const token = this.tokens[i];
            token.userData.progress += dt * 0.5; // Speed

            if (token.userData.progress >= 1) {
                // Remove when finished
                token.removeFromParent();
                this.tokens.splice(i, 1);
            } else {
                // Update Position
                const point = this.curve.getPoint(token.userData.progress);
                token.position.copy(point);
            }
        }
    }

    private spawnToken() {
        const geo = new THREE.SphereGeometry(0.015);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const token = new THREE.Mesh(geo, mat);
        token.userData = { progress: 0 };
        this.tokens.push(token);
        this.add(token);
    }
}
