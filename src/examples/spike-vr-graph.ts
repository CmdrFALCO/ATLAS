import ForceGraph3D from 'three-forcegraph';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import * as THREE from 'three';
import { VRNode, VREdge, VRCluster } from '../shared/types.ts';

// Fake Data Generation
const clusters: VRCluster[] = [
    { id: 'c0', label: 'Chemistry', color: '#3b82f6' },
    { id: 'c1', label: 'Thermal', color: '#22c55e' },
    { id: 'c2', label: 'Manufacturing', color: '#f59e0b' },
    { id: 'c3', label: 'Testing', color: '#ef4444' },
    { id: 'c4', label: 'Strategy', color: '#8b5cf6' }
];

const nodes: VRNode[] = Array.from({ length: 200 }, (_, i) => ({
    id: `note-${i}`,
    title: `Note ${i}`,
    clusterId: `c${Math.floor(Math.random() * 5)}`,
    connectionCount: Math.floor(Math.random() * 10),
    isAISuggested: false
}));

const edges: VREdge[] = Array.from({ length: 300 }, (_, i) => ({
    id: `edge-${i}`,
    source: `note-${Math.floor(Math.random() * 200)}`,
    target: `note-${Math.floor(Math.random() * 200)}`,
    type: Math.random() > 0.7 ? 'ai_suggested' : 'explicit',
    confidence: Math.random()
}));

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000011);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 2; // Start just outside the graph

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// Light
const ambientLight = new THREE.AmbientLight(0xbbbbbb);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Graph
const graph = new ForceGraph3D()
    .graphData({ nodes, links: edges })
    .nodeLabel('title')
    .nodeColor((n: any) => {
        const node = n as VRNode;
        const cluster = clusters.find(c => c.id === node.clusterId);
        return cluster ? cluster.color : '#ffffff';
    })
    .linkColor((e: any) => {
        const edge = e as VREdge;
        return edge.type === 'explicit' ? '#3b82f6' : '#22c55e';
    })
    .linkOpacity(0.6)
    .nodeResolution(16);

// Scale down to VR size (meters)
graph.scale.set(0.01, 0.01, 0.01);
graph.position.y = 1.5; // Eye height

scene.add(graph);

// Animation Loop
renderer.setAnimationLoop(() => {
    graph.tickFrame();
    renderer.render(scene, camera);
});

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
