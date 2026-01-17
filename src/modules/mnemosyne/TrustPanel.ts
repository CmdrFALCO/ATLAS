import * as THREE from 'three';
import { VRNode } from '../../shared/types';

export class TrustPanel extends THREE.Group {
    private mesh: THREE.Mesh;
    private texture: THREE.CanvasTexture;
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;

    // Interactive Zones
    public btnAccept: THREE.Mesh;
    public btnReject: THREE.Mesh;

    constructor() {
        super();

        // 1. Create Canvas for UI
        this.canvas = document.createElement('canvas');
        this.canvas.width = 512;
        this.canvas.height = 256;
        this.context = this.canvas.getContext('2d')!;
        this.texture = new THREE.CanvasTexture(this.canvas);

        // 2. Create Panel Mesh
        const geometry = new THREE.PlaneGeometry(0.5, 0.25); // 50cm x 25cm
        const material = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.add(this.mesh);

        // 3. Create Interactive Buttons (Invisible Hit Targets)
        // Positioned relative to the panel
        const btnGeo = new THREE.PlaneGeometry(0.15, 0.05);
        const btnMat = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0,
            depthWrite: false // CRITICAL: Prevent "Black Box" occlusion artifact
        });

        this.btnAccept = new THREE.Mesh(btnGeo, btnMat.clone());
        this.btnAccept.position.set(-0.12, -0.06, 0.01); // Bottom Leftish
        this.btnAccept.userData = { id: 'accept', type: 'button' };
        this.add(this.btnAccept);

        this.btnReject = new THREE.Mesh(btnGeo, btnMat.clone());
        this.btnReject.position.set(0.12, -0.06, 0.01); // Bottom Rightish
        this.btnReject.userData = { id: 'reject', type: 'button' };
        this.add(this.btnReject);

        this.visible = false;
    }

    public show(node: VRNode) {
        this.drawUI(node);
        this.visible = true;
    }

    public hide() {
        this.visible = false;
    }

    private drawUI(node: VRNode) {
        const ctx = this.context;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Background
        ctx.fillStyle = 'rgba(20, 20, 30, 0.9)';
        ctx.fillRect(0, 0, w, h);

        // Border
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, w, h);

        // Title
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(node.title, w / 2, 50);

        // Cluster
        ctx.font = '24px Arial';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(`Cluster: ${node.clusterId}`, w / 2, 90);

        // AI Confidence (Mock)
        ctx.font = 'italic 20px Arial';
        ctx.fillStyle = '#00ff00';
        ctx.fillText(`AI Confidence: 89%`, w / 2, 130);

        // Buttons (Visuals drawn on canvas, logic handled by hit-boxes)
        // Accept (Green)
        ctx.fillStyle = '#228822';
        ctx.fillRect(40, 160, 200, 60);
        ctx.fillStyle = '#ffffff';
        ctx.fillText("ACCEPT", 140, 200);

        // Reject (Red)
        ctx.fillStyle = '#882222';
        ctx.fillRect(272, 160, 200, 60);
        ctx.fillStyle = '#ffffff';
        ctx.fillText("REJECT", 372, 200);

        this.texture.needsUpdate = true;
    }
}
