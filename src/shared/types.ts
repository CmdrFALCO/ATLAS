
// Mnemosyne (Knowledge Graph) - Mirrored from ATHENA
export interface VRNode {
    id: string;
    title: string;
    clusterId?: string; // Maps to Cluster.id
    connectionCount: number;
    isAISuggested: boolean;
}

export interface VREdge {
    id: string;
    source: string; // Note ID
    target: string; // Note ID
    type: 'explicit' | 'ai_suggested' | 'cluster';
    confidence?: number; // 0-1 for AI suggestions
}

export interface VRCluster {
    id: string;
    label: string;
    color: string;
}

// Tecton (CellCAD) - Module Manifest
export interface ModuleVariant {
    id: string;
    file: string; // Path to GLTF (converted from STEP via FreeCAD)
    params: {
        cellCount: number;
        cooling: 'liquid' | 'air';
        energy_kwh: number;
        mass_kg: number;
        cost_relative: number;
        thermal_headroom: 'good' | 'moderate' | 'poor';
    };
}
