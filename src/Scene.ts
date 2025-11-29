import * as THREE from 'three';
import { BoidSystem } from './BoidSystem';
import { BoidConfig } from './BoidConfig';

/**
 * Three.js scene management - drone simulation above city
 */
export class Scene {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;

    // Boid rendering
    private boidSystem: BoidSystem;
    private instancedMesh: THREE.InstancedMesh;
    private dummy = new THREE.Object3D();

    // Environment elements
    // Environment elements
    // private cityGround: THREE.Mesh;
    private buildings!: THREE.Group;
    // private skybox: THREE.Mesh;

    // Debug visualization
    private neighborLines?: THREE.LineSegments;
    private velocityLines?: THREE.LineSegments;

    // Camera control
    private cameraAngle = 0;
    private cameraRadius = 800;
    private cameraHeight = 400;
    private autoRotate = true;

    constructor(container: HTMLElement, boidSystem: BoidSystem) {
        this.boidSystem = boidSystem;

        // Initialize scene
        this.scene = new THREE.Scene();
        // Use a black background for the night scene
        // this.scene.background = new THREE.Color(0x000000);
        // this.scene.fog = new THREE.Fog(0x000000, 500, 2000);

        // Initialize camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            1,
            3000
        );
        this.camera.position.set(0, this.cameraHeight, this.cameraRadius);
        this.camera.lookAt(0, 200, 0);

        // Initialize renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        // Create environment
        this.createEnvironment();

        // Create Boid instanced mesh
        this.instancedMesh = this.createBoidMesh(boidSystem.boids.length);
        this.scene.add(this.instancedMesh);

        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Mouse interaction
        this.setupMouseInteraction();
    }

    /**
     * Create a procedural starry background using a CanvasTexture on an inverted sphere.
     */
    private createBackground(): void {

        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

        // Gradient background
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#000011');
        grad.addColorStop(0.5, '#000022');
        grad.addColorStop(1, '#000000');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Stars
        const starCount = 800;
        for (let i = 0; i < starCount; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const r = Math.random() * 1.2;
            const a = 0.4 + Math.random() * 0.6;
            ctx.beginPath();
            ctx.fillStyle = `rgba(255,255,255,${a})`;
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
    }

    /**
     * Place an image on a plane at the outer positive-Z edge of the scene bounds.
     * Image should be placed in `public/edge.png` (or pass a different path).
     */
    private createEdgeImage(imageUrl = '/assets/shenzhen_night.png'): void {
        const min = this.boidSystem.config.bounds.min;
        const max = this.boidSystem.config.bounds.max;
        const pad = 20;

        // Position just outside the negative Z boundary
        const z = min.z - pad - 1;
        const centerX = (min.x + max.x) / 2;
        const centerY = (min.y + max.y) / 2;

        // Size the plane a bit larger than the bounds in X and Y
        const width = (max.x - min.x) + 300;
        const height = Math.max(200, (max.y - min.y));

        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({ color: 0x111133, side: THREE.DoubleSide });
        const plane = new THREE.Mesh(geometry, material);
        plane.position.set(centerX, centerY, z);
        // Face the plane inward towards negative Z
        plane.rotation.y = Math.PI;

        // Make sure plane does not receive shadows and renders behind other objects
        plane.receiveShadow = false;
        plane.castShadow = false;
        plane.renderOrder = -1;

        this.scene.add(plane);

        // Load texture (non-blocking). Fallback stays the solid color.
        const loader = new THREE.TextureLoader();
        loader.load(
            imageUrl,
            (tex) => {
                // optional anisotropy for better quality
                try {
                    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
                } catch (_) {}
                material.map = tex;
                material.needsUpdate = true;
            },
            undefined,
            (err) => {
                // Loading failed; keep fallback color and log a warning
                // eslint-disable-next-line no-console
                console.warn('Failed to load edge image:', imageUrl, err);
            }
        );
    }

    /**
     * Create city environment
     */
    private createEnvironment(): void {
        // Lighting for night scene
        // Soft ambient to lift shadows a bit
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        // Hemisphere light to provide subtle sky/ground color contrast
        const hemi = new THREE.HemisphereLight(0x222244, 0x080808, 0.4);
        this.scene.add(hemi);

        // Directional moonlight with shadows
        const moonLight = new THREE.DirectionalLight(0x99aaff, 0.7);
        moonLight.position.set(200, 400, 150);
        moonLight.castShadow = true;
        moonLight.shadow.mapSize.width = 2048;
        moonLight.shadow.mapSize.height = 2048;
        const d = 1000;
        moonLight.shadow.camera.left = -d;
        moonLight.shadow.camera.right = d;
        moonLight.shadow.camera.top = d;
        moonLight.shadow.camera.bottom = -d;
        moonLight.shadow.camera.near = 1;
        moonLight.shadow.camera.far = 2000;
        this.scene.add(moonLight);

        // Optional: Add a ground plane to catch shadows if needed, but keep it dark
        const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x050505,
            roughness: 1.0,
            metalness: 0.0
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Initialize buildings group and populate
        this.buildings = new THREE.Group();
        this.scene.add(this.buildings);
        this.createBuildings();

        // Add procedural background
        this.createBackground();

        // Add an edge image on the outer Z boundary (negative Z side)
        this.createEdgeImage('/bg.png');

        // Warm city glow: scattered point lights to create window/street glow
        const cityLightCount = 8;
        for (let i = 0; i < cityLightCount; i++) {
            const intensity = 0.6 + Math.random() * 0.6;
            const dist = 600 + Math.random() * 600;
            const light = new THREE.PointLight(0xffcc88, intensity, dist, 2);
            light.position.set((Math.random() - 0.5) * 1200, 50 + Math.random() * 200, (Math.random() - 0.5) * 1200);
            // keep point lights from casting expensive shadows
            light.castShadow = false;
            this.scene.add(light);
        }
    }

    /**
     * Create buildings
     */
    private createBuildings(): void {
        // Single gray material for all buildings
        const grayMaterial = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.75, metalness: 0.25 });

        // Create buildings around the boid bounds perimeter, leaving one side open.
        // We'll use the boidSystem bounds so buildings surround the active cube.
        const min = this.boidSystem.config.bounds.min;
        const max = this.boidSystem.config.bounds.max;

        // Padding from the bounds so buildings don't intersect exactly on edges
        const pad = 20;

        const leftX = min.x - pad;
        const rightX = max.x + pad;
        const topZ = min.z - pad;
        const bottomZ = max.z + pad;

        // Spacing between buildings along edges
        const spacing = 40;

        // Which side to leave open? ("top"|"right"|"bottom"|"left")
        // Default: leave the positive Z side (bottom) open so drones can enter from front.
        let openSide: string = 'bottom';

        // Helper to create a building at (x,z)
        const addBuildingAt = (x: number, z: number) => {
            const width = 20 + Math.random() * 40;
            const height = 50 + Math.random() * 200;
            const depth = 20 + Math.random() * 40;
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const building = new THREE.Mesh(geometry, grayMaterial);
            building.position.set(x, height / 2, z);
            building.castShadow = true;
            building.receiveShadow = true;
            this.buildings.add(building);

            // Add subtle window lights on some buildings
            if (Math.random() > 0.6) {
                const windowLight = new THREE.PointLight(0xffaa66, 0.4, 120);
                windowLight.position.set(0, height * 0.6, 0);
                building.add(windowLight);
            }
        };

        // Left edge (x = leftX), z from min.z to max.z
        if (openSide !== 'left') {
            for (let z = min.z; z <= max.z; z += spacing) {
                addBuildingAt(leftX, z);
            }
        }

        // Right edge (x = rightX)
        if (openSide !== 'right') {
            for (let z = min.z; z <= max.z; z += spacing) {
                addBuildingAt(rightX, z);
            }
        }

        // Top edge (z = topZ), x from min.x to max.x
        if (openSide !== 'top') {
            for (let x = min.x; x <= max.x; x += spacing) {
                addBuildingAt(x, topZ);
            }
        }

        // Bottom edge (z = bottomZ)
        if (openSide !== 'bottom') {
            for (let x = min.x; x <= max.x; x += spacing) {
                addBuildingAt(x, bottomZ);
            }
        }
    }

    /**
     * Create Boid instanced mesh
     */
    private createBoidMesh(count: number): THREE.InstancedMesh {
        // For the story, we represent drones as simple points of light.
        // A sphere geometry is a good choice for this.
        const geometry = new THREE.SphereGeometry(0.8, 8, 8);

        // The material should be emissive to represent light.
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 1.0, // We will control this per instance
        });

        const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
        instancedMesh.castShadow = false; // Lights don't cast shadows in this simple setup

        return instancedMesh;
    }

    /**
     * Update Boid rendering
     */
    updateBoids(): void {
        const boids = this.boidSystem.boids;
        const tempColor = new THREE.Color();

        for (let i = 0; i < boids.length; i++) {
            const boid = boids[i];

            // Set position
            this.dummy.position.copy(boid.position);

            // Set scale based on visibility and light intensity
            // If not visible or light is off, scale to zero.
            const scale = boid.isVisible && boid.lightIntensity > 0
                ? this.boidSystem.config.droneSize * boid.lightIntensity
                : 0;
            this.dummy.scale.set(scale, scale, scale);
            
            this.dummy.updateMatrix();
            this.instancedMesh.setMatrixAt(i, this.dummy.matrix);

            // Set color and emissive intensity
            tempColor.set(boid.color);
            // We modulate the color by the light intensity to make it dimmer or brighter.
            tempColor.multiplyScalar(boid.lightIntensity);
            this.instancedMesh.setColorAt(i, tempColor);
        }

        this.instancedMesh.instanceMatrix.needsUpdate = true;
        if (this.instancedMesh.instanceColor) {
            this.instancedMesh.instanceColor.needsUpdate = true;
        }
    }

    /**
     * Update camera
     */
    updateCamera(): void {
        if (this.autoRotate) {
            this.cameraAngle += 0.001;
            this.camera.position.x = Math.cos(this.cameraAngle) * this.cameraRadius;
            this.camera.position.z = Math.sin(this.cameraAngle) * this.cameraRadius;
            this.camera.position.y = this.cameraHeight;
            this.camera.lookAt(0, 200, 0);
        }
    }

    /**
     * Render
     */
    render(): void {
        this.updateCamera();
        this.updateBoids();
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Window resize
     */
    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Mouse interaction setup
     */
    private setupMouseInteraction(): void {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };

        this.renderer.domElement.addEventListener('mousedown', (e) => {
            isDragging = true;
            this.autoRotate = false;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        this.renderer.domElement.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;

                this.cameraAngle -= deltaX * 0.01;
                this.cameraHeight = Math.max(100, Math.min(800, this.cameraHeight + deltaY));

                this.camera.position.x = Math.cos(this.cameraAngle) * this.cameraRadius;
                this.camera.position.z = Math.sin(this.cameraAngle) * this.cameraRadius;
                this.camera.position.y = this.cameraHeight;
                this.camera.lookAt(0, 200, 0);

                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });

        this.renderer.domElement.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Mouse wheel zoom
        this.renderer.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.cameraRadius = Math.max(200, Math.min(1500, this.cameraRadius + e.deltaY * 0.5));
            this.camera.position.x = Math.cos(this.cameraAngle) * this.cameraRadius;
            this.camera.position.z = Math.sin(this.cameraAngle) * this.cameraRadius;
        });
    }

    /**
     * Toggle auto rotation
     */
    toggleAutoRotate(): void {
        this.autoRotate = !this.autoRotate;
    }

    /**
     * Rebuild instanced mesh (when Boid count changes)
     */
    rebuildInstancedMesh(count: number): void {
        this.scene.remove(this.instancedMesh);
        this.instancedMesh.dispose();
        this.instancedMesh = this.createBoidMesh(count);
        this.scene.add(this.instancedMesh);
    }
}

