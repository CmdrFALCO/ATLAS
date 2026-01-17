import * as THREE from 'three';

export class SubtitleOverlay extends THREE.Group {
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private texture: THREE.CanvasTexture;
    private mesh: THREE.Mesh;
    private visibleTimer: number = 0;

    constructor() {
        super();

        // 1. Create High-Res Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = 1024;
        this.canvas.height = 256;
        this.context = this.canvas.getContext('2d')!;

        // 2. Create Texture
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.minFilter = THREE.LinearFilter;

        // 3. Create Mesh
        // Size: 1.5m wide, 0.375m high (Aspect ratio 4:1)
        const geometry = new THREE.PlaneGeometry(1.5, 0.375);
        const material = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            opacity: 0, // Hidden initially
            depthTest: false, // Always on top? Maybe.
            depthWrite: false
        });

        this.mesh = new THREE.Mesh(geometry, material);
        // Position: Slightly below eye level, 2m away
        this.mesh.position.set(0, -0.2, -2);
        this.add(this.mesh);

        // Render empty initially
        this.clearText();
    }

    public show(text: string, duration: number = 5) {
        this.visibleTimer = duration;

        // Draw Text
        const ctx = this.context;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Background (Semi-transparent black pill)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.roundRect(ctx, 50, 20, w - 100, h - 40, 40);
        ctx.fill();

        // Text
        ctx.font = '48px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Wrap Text
        const maxWidth = w - 120; // Padding
        const lineHeight = 56;
        const lines = this.wrapText(ctx, text, maxWidth);

        // Calculate total height to center vertically
        const totalTextHeight = lines.length * lineHeight;
        let startY = (h - totalTextHeight) / 2 + (lineHeight / 2);

        lines.forEach((line, i) => {
            ctx.fillText(line, w / 2, startY + (i * lineHeight));
        });

        this.texture.needsUpdate = true;

        // Fade In
        (this.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
    }

    private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }

    public hide() {
        this.visibleTimer = 0;
        (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    public update(dt: number) {
        if (this.visibleTimer > 0) {
            this.visibleTimer -= dt;
            if (this.visibleTimer <= 0) {
                this.hide();
            }
        }
    }

    private clearText() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.texture.needsUpdate = true;
    }

    private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
}
