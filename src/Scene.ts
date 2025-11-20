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
    // private cityGround: THREE.Mesh;
    // private buildings: THREE.Group;
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
        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.Fog(0x000000, 500, 2000);

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
     * Create city environment
     */
    private createEnvironment(): void {
        // Lighting for night scene
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5); // Dim ambient light
        this.scene.add(ambientLight);

        const moonLight = new THREE.DirectionalLight(0x202040, 0.6); // Faint blueish moonlight
        moonLight.position.set(200, 400, 150);
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
    }

    /**
     * Create buildings
     */
    private createBuildings(): void {
        const buildingCount = 50;
        const buildingMaterials = [
            new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7, metalness: 0.3 }),
            new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.6, metalness: 0.4 }),
            new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8, metalness: 0.2 })
        ];

        for (let i = 0; i < buildingCount; i++) {
            const width = 20 + Math.random() * 40;
            const height = 50 + Math.random() * 200;
            const depth = 20 + Math.random() * 40;

            const geometry = new THREE.BoxGeometry(width, height, depth);
            const material = buildingMaterials[Math.floor(Math.random() * buildingMaterials.length)];
            const building = new THREE.Mesh(geometry, material);

            building.position.x = (Math.random() - 0.5) * 900;
            building.position.z = (Math.random() - 0.5) * 900;
            building.position.y = height / 2;

            building.castShadow = true;
            building.receiveShadow = true;

            this.buildings.add(building);

            // Add window lighting effects
            if (Math.random() > 0.5) {
                const windowLight = new THREE.PointLight(0xffaa00, 0.5, 100);
                windowLight.position.set(0, height * 0.7, 0);
                building.add(windowLight);
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

