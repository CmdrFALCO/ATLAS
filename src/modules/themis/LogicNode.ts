import * as THREE from 'three';

export type LogicType = 'AND' | 'OR' | 'NOT' | 'SOURCE' | 'SINK';

export class LogicNode extends THREE.Group {
    public nodeId: string;
    public type: LogicType;
    public state: boolean = false;

    private body: THREE.Mesh;
    public inputPorts: THREE.Mesh[] = [];
    public outputPorts: THREE.Mesh[] = [];

    constructor(id: string, type: LogicType, position: THREE.Vector3) {
        super();
        this.nodeId = id;
        this.type = type;
        this.position.copy(position);

        // Visuals
        const color = this.getTypeColor(type);
        const geometry = new THREE.BoxGeometry(0.3, 0.2, 0.05);
        const material = new THREE.MeshStandardMaterial({ color: color });
        this.body = new THREE.Mesh(geometry, material);
        this.body.userData = { id: this.nodeId, type: 'node' }; // Interactable
        this.add(this.body); // Original line, keeping it as `this.body`

        // Physics/Interaction Data
        this.userData = {
            type: 'node',
            nodeId: this.nodeId,
            grabbable: true // WP-09: Enable Grabbing
        };

        // Label
        this.addLabel(type);

        // Ports
        this.createPorts(type);
    }

    private getTypeColor(type: LogicType): number {
        switch (type) {
            case 'AND': return 0x224488; // Blue
            case 'OR': return 0x884422;  // Orange
            case 'NOT': return 0x882222; // Red
            case 'SOURCE': return 0x228822; // Green
            case 'SINK': return 0x444444; // Grey
            default: return 0xffffff;
        }
    }

    private addLabel(text: string) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(0, 0, 128, 64);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(text, 64, 45);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(0.2, 0.1, 1);
        sprite.position.z = 0.06; // In front of box
        this.add(sprite);
    }

    private createPorts(type: LogicType) {
        const portGeo = new THREE.SphereGeometry(0.04); // Increased size
        const portMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.3 });

        // Logic for inputs/outputs
        let inputs = 0;
        let outputs = 0;

        if (type === 'AND' || type === 'OR') { inputs = 2; outputs = 1; }
        else if (type === 'NOT') { inputs = 1; outputs = 1; }
        else if (type === 'SOURCE') { inputs = 0; outputs = 1; }
        else if (type === 'SINK') { inputs = 1; outputs = 0; }

        console.log(`[LogicNode] ${this.nodeId} (${type}) -> Inputs: ${inputs}, Outputs: ${outputs}`);

        // Create Input Ports (Left side)
        for (let i = 0; i < inputs; i++) {
            const port = new THREE.Mesh(portGeo, portMat.clone());
            // Stack vertically if multiple
            const yOffset = inputs > 1 ? (i === 0 ? 0.05 : -0.05) : 0;
            port.position.set(-0.15, yOffset, 0.05); // Move forward Z
            port.userData = { id: `${this.nodeId}_in_${i}`, parentId: this.nodeId, type: 'port', isInput: true };
            this.inputPorts.push(port);
            this.add(port);
        }

        // Create Output Ports (Right side)
        for (let i = 0; i < outputs; i++) {
            const port = new THREE.Mesh(portGeo, portMat.clone());
            port.position.set(0.15, 0, 0.05); // Move forward Z
            port.userData = { id: `${this.nodeId}_out_${i}`, parentId: this.nodeId, type: 'port', isInput: false };
            this.outputPorts.push(port);
            this.add(port);
        }
    }

    public setState(active: boolean) {
        this.state = active;
        // Visual feedback (Illuminate body)
        if (active) {
            (this.body.material as THREE.MeshBasicMaterial).color.set(0x00ff00); // Bright Green
        } else {
            (this.body.material as THREE.MeshBasicMaterial).color.set(this.getTypeColor(this.type));
        }
    }
}
