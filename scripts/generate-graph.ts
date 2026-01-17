import fs from 'fs';
import path from 'path';
import { VRNode, VREdge, VRCluster } from '../src/shared/types';

// Configuration
const NODE_COUNT = 150;
const CLUSTERS: VRCluster[] = [
    { id: 'c_chem', label: 'Chemistry', color: '#3b82f6' },      // Blue
    { id: 'c_therm', label: 'Thermal', color: '#22c55e' },       // Green
    { id: 'c_mfg', label: 'Manufacturing', color: '#f59e0b' },   // Amber
    { id: 'c_test', label: 'Testing', color: '#ef4444' },        // Red
    { id: 'c_strat', label: 'Strategy', color: '#8b5cf6' }       // Violet
];

// Content Pools for Titles
const PREFIXES = ['Advanced', 'Hybrid', 'Thermal', 'Quantum', 'Polymer', 'Structural', 'Nano', 'Bio'];
const SUFFIXES = ['Matrix', 'Alloy', 'Interface', 'Protocol', 'Composite', 'Analysis', 'Synthesis', 'Framework'];

function generateTitle(): string {
    return `${PREFIXES[Math.floor(Math.random() * PREFIXES.length)]} ${SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)]}`;
}

const nodes: VRNode[] = [];
const edges: VREdge[] = [];

// 1. Generate Nodes
CLUSTERS.forEach(cluster => {
    // Distribute nodes roughly evenly
    const count = Math.floor(NODE_COUNT / CLUSTERS.length);
    for (let i = 0; i < count; i++) {
        const id = `node_${cluster.id}_${i}`;
        nodes.push({
            id,
            title: generateTitle(),
            clusterId: cluster.id,
            connectionCount: 0,
            isAISuggested: false
        });
    }
});

// 2. Generate Edges (Intra-cluster)
nodes.forEach(source => {
    // Connect to 2-4 other nodes in same cluster
    const targets = nodes.filter(n => n.clusterId === source.clusterId && n.id !== source.id);
    const linkCount = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < linkCount; i++) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        const edgeId = `edge_${source.id}_${target.id}`;

        // Avoid duplicates (naive check)
        if (!edges.find(e => (e.source === source.id && e.target === target.id) || (e.source === target.id && e.target === source.id))) {
            edges.push({
                id: edgeId,
                source: source.id,
                target: target.id,
                type: 'explicit'
            });
            source.connectionCount++;
            target.connectionCount++;
        }
    }
});

// 3. Generate Inter-cluster Edges (The "Bridges")
for (let i = 0; i < 20; i++) {
    const source = nodes[Math.floor(Math.random() * nodes.length)];
    const target = nodes.filter(n => n.clusterId !== source.clusterId)[Math.floor(Math.random() * (nodes.length - (nodes.length / CLUSTERS.length)))]; // Pick from diff cluster

    if (target) {
        edges.push({
            id: `bridge_${i}`,
            source: source.id,
            target: target.id,
            type: 'explicit'
        });
    }
}

// 4. Generate AI Suggestions (The "Magic")
for (let i = 0; i < 8; i++) {
    const source = nodes[Math.floor(Math.random() * nodes.length)];
    const target = nodes.filter(n => n.clusterId !== source.clusterId)[Math.floor(Math.random() * 100)];

    if (target) {
        edges.push({
            id: `ai_${i}`,
            source: source.id,
            target: target.id,
            type: 'ai_suggested',
            confidence: 0.85 + (Math.random() * 0.14) // 0.85 - 0.99
        });

        // Mark nodes as having AI suggestions for visualization
        source.isAISuggested = true;
        target.isAISuggested = true;
    }
}

const output = {
    nodes,
    links: edges, // ForceGraph expects 'links'
    clusters: CLUSTERS
};

// Ensure public/data exists
const dir = path.join(process.cwd(), 'public', 'data');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(path.join(dir, 'knowledge-graph.json'), JSON.stringify(output, null, 2));
console.log(`Generated ${nodes.length} nodes and ${edges.length} edges in public/data/knowledge-graph.json`);
