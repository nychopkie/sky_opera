import GUI from 'lil-gui';
import { Vector3 } from 'three';
import { BoidSystem } from './BoidSystem';
import { Scene } from './Scene';
import { StoryController } from './StoryController';

/**
 * GUI parameter control panel
 */
export class Controls {
    private gui: GUI;
    private boidSystem: BoidSystem;
    private scene: Scene;
    private statsElement!: HTMLDivElement;

    constructor(boidSystem: BoidSystem, scene: Scene) {
        this.boidSystem = boidSystem;
        this.scene = scene;
        this.gui = new GUI({ title: 'Drone Swarm Control Panel' });
        (this.gui.domElement as HTMLElement).style.width = '320px';

        this.setupGUI();
        this.setupStats();
    }

    public addStoryModeButton(storyController: StoryController): void {
        const storyControls = {
            isStoryRunning: false,
            toggleStory: () => {
                storyControls.isStoryRunning = !storyControls.isStoryRunning;
                if (storyControls.isStoryRunning) {
                    storyController.start();
                    // Disable flocking during story
                    this.boidSystem.config.enableFlocking = false;
                } else {
                    storyController.stop();
                    // Re-enable flocking after story
                    this.boidSystem.config.enableFlocking = true;
                    this.boidSystem.reset(); // Reset to random positions
                }
                 this.gui.controllersRecursive().forEach(c => c.updateDisplay());
            }
        };

        const presetsFolder = this.gui.folders.find(f => f._title === 'Preset Modes') || this.gui.addFolder('Preset Modes');
        presetsFolder.add(storyControls, 'toggleStory').name('🎇 Play Demo Story');
    }

    /**
     * Setup GUI control panel
     */
    private setupGUI(): void {
        const config = this.boidSystem.config;

        // ========== Swarm Parameters ==========
        const swarmFolder = this.gui.addFolder('Swarm Parameters');
        swarmFolder.add({ count: this.boidSystem.boids.length }, 'count', 100, 5000, 100)
            .name('Drone Count')
            .onChange((value: number) => {
                this.boidSystem.initializeBoids(value);
                this.scene.rebuildInstancedMesh(value);
            });
        swarmFolder.add(config, 'enableFlocking').name('Enable Flocking');
        swarmFolder.open();

        // ========== Core Behavior Weights ==========
        const behaviorsFolder = this.gui.addFolder('Behavior Weights');
        behaviorsFolder.add(config, 'separationWeight', 0, 5, 0.1).name('Separation Weight');
        behaviorsFolder.add(config, 'alignmentWeight', 0, 5, 0.1).name('Alignment Weight');
        behaviorsFolder.add(config, 'cohesionWeight', 0, 5, 0.1).name('Cohesion Weight');
        behaviorsFolder.add(config, 'wanderWeight', 0, 2, 0.1).name('Wander Weight');
        behaviorsFolder.add(config, 'targetWeight', 0, 2, 0.1).name('Target Attraction Weight');
        behaviorsFolder.add(config, 'avoidanceWeight', 0, 5, 0.1).name('Avoidance Weight (Reserved)');
        behaviorsFolder.open();

        // ========== Perception Distances ==========
        const perceptionFolder = this.gui.addFolder('Perception Distances');
        perceptionFolder.add(config, 'separationDistance', 5, 100, 5).name('Separation Distance');
        perceptionFolder.add(config, 'alignmentDistance', 10, 200, 10).name('Alignment Distance');
        perceptionFolder.add(config, 'cohesionDistance', 10, 200, 10).name('Cohesion Distance');
        perceptionFolder.add(config, 'avoidanceDistance', 20, 300, 10).name('Avoidance Distance');
        perceptionFolder.open();

        // ========== Motion Constraints ==========
        const motionFolder = this.gui.addFolder('Motion Parameters');
        motionFolder.add(config, 'maxSpeed', 1, 20, 0.5).name('Max Speed');
        motionFolder.add(config, 'maxForce', 0.01, 1, 0.01).name('Max Steering Force');
        motionFolder.add(config, 'maxAcceleration', 0.1, 2, 0.1).name('Max Acceleration');
        motionFolder.open();

        // ========== Vision Parameters ==========
        const visionFolder = this.gui.addFolder('Vision Settings');
        visionFolder.add(config, 'useVisionCone').name('Enable Vision Cone Restriction');
        visionFolder.add(config, 'visionAngle', 0, 360, 10).name('Vision Angle (degrees)');
        visionFolder.open();

        // ========== Boundary Settings ==========
        const boundaryFolder = this.gui.addFolder('Boundary Settings');
        boundaryFolder.add(config, 'boundaryType', ['wrap', 'bounce', 'soft']).name('Boundary Type');
        boundaryFolder.add(config, 'boundaryMargin', 10, 200, 10).name('Boundary Margin');
        boundaryFolder.add(config, 'boundaryForce', 0, 2, 0.1).name('Boundary Force');

        const boundsFolder = boundaryFolder.addFolder('Spatial Bounds');
        boundsFolder.add(config.bounds.min, 'x', -1000, 0, 50).name('Min X');
        boundsFolder.add(config.bounds.min, 'y', -100, 100, 10).name('Min Y');
        boundsFolder.add(config.bounds.min, 'z', -1000, 0, 50).name('Min Z');
        boundsFolder.add(config.bounds.max, 'x', 0, 1000, 50).name('Max X');
        boundsFolder.add(config.bounds.max, 'y', 100, 1000, 50).name('Max Y');
        boundsFolder.add(config.bounds.max, 'z', 0, 1000, 50).name('Max Z');

        // ========== Wander Behavior ==========
        const wanderFolder = this.gui.addFolder('Wander Behavior');
        wanderFolder.add(config, 'wanderRadius', 5, 50, 5).name('Wander Radius');
        wanderFolder.add(config, 'wanderDistance', 10, 100, 10).name('Projection Distance');
        wanderFolder.add(config, 'wanderJitter', 0.1, 5, 0.1).name('Jitter Strength');

        // ========== Target Point Control ==========
        const targetFolder = this.gui.addFolder('Target Point Settings');
        const targetControls = {
            enabled: false,
            x: 0,
            y: 250,
            z: 0,
            setTarget: () => {
                if (targetControls.enabled) {
                    const target = new Vector3(
                        targetControls.x,
                        targetControls.y,
                        targetControls.z
                    );
                    this.boidSystem.setTarget(target);
                } else {
                    this.boidSystem.setTarget(null);
                }
            }
        };
        targetFolder.add(targetControls, 'enabled').name('Enable Target Point').onChange(() => targetControls.setTarget());
        targetFolder.add(targetControls, 'x', -500, 500, 10).name('X Coordinate').onChange(() => targetControls.setTarget());
        targetFolder.add(targetControls, 'y', 0, 500, 10).name('Y Coordinate').onChange(() => targetControls.setTarget());
        targetFolder.add(targetControls, 'z', -500, 500, 10).name('Z Coordinate').onChange(() => targetControls.setTarget());

        // ========== Performance Optimization ==========
        const performanceFolder = this.gui.addFolder('Performance Optimization');
        performanceFolder.add(config, 'spatialHashCellSize', 20, 200, 10).name('Spatial Grid Cell Size');
        performanceFolder.add(config, 'maxNeighbors', 10, 200, 10).name('Max Neighbors Count');

        // ========== Rendering Settings ==========
        const renderFolder = this.gui.addFolder('Rendering Settings');
        renderFolder.add(config, 'droneSize', 0.5, 5, 0.1).name('Drone Size');
        renderFolder.add({ autoRotate: true }, 'autoRotate').name('Auto Rotate Camera')
            .onChange((value: boolean) => {
                if (value) this.scene.toggleAutoRotate();
            });

        // Boid material controls (base color + emissive)
        const matState = this.scene.getBoidMaterialState();
        const boidMatControls = {
            baseColor: matState.baseColor,
            emissiveColor: matState.emissiveColor,
            emissiveIntensity: matState.emissiveIntensity
        };

        renderFolder.addColor(boidMatControls, 'baseColor').name('Boid Base Color').onChange((v: any) => {
            this.scene.setBoidBaseColor(v);
        });

        renderFolder.addColor(boidMatControls, 'emissiveColor').name('Boid Emissive Color').onChange((v: any) => {
            this.scene.setBoidEmissiveColor(v);
            // also store in config so StoryController or other systems can read it
            if (typeof v === 'string' && v.startsWith('#')) {
                this.boidSystem.config.emissiveColor = parseInt(v.slice(1), 16);
            } else if (typeof v === 'number') {
                this.boidSystem.config.emissiveColor = v;
            }
        });

        renderFolder.add(boidMatControls, 'emissiveIntensity', 0, 5, 0.01).name('Emissive Intensity').onChange((v: number) => {
            this.scene.setBoidEmissiveIntensity(v);
            this.boidSystem.config.emissiveIntensity = v;
        });

        // ========== Preset Modes ==========
        const presetsFolder = this.gui.addFolder('Preset Modes');

        presetsFolder.add({
            calm: () => this.applyPreset('calm')
        }, 'calm').name('🕊️ Calm Flight');

        presetsFolder.add({
            chaotic: () => this.applyPreset('chaotic')
        }, 'chaotic').name('🌪️ Chaotic Mode');

        presetsFolder.add({
            tight: () => this.applyPreset('tight')
        }, 'tight').name('🎯 Tight Formation');

        presetsFolder.add({
            exploration: () => this.applyPreset('exploration')
        }, 'exploration').name('🔍 Exploration Mode');

        // ========== System Operations ==========
        const systemFolder = this.gui.addFolder('System Operations');
        systemFolder.add({ reset: () => this.boidSystem.reset() }, 'reset').name('🔄 Reset Positions');
        systemFolder.add({
            export: () => this.exportConfig()
        }, 'export').name('💾 Export Config');
        systemFolder.add({
            import: () => this.importConfig()
        }, 'import').name('📂 Import Config');
        systemFolder.open();
    }

    /**
     * Apply preset mode
     */
    private applyPreset(preset: string): void {
        const config = this.boidSystem.config;

        switch (preset) {
            case 'calm':
                config.separationWeight = 1.0;
                config.alignmentWeight = 1.5;
                config.cohesionWeight = 1.0;
                config.maxSpeed = 3.0;
                config.wanderWeight = 0.05;
                break;

            case 'chaotic':
                config.separationWeight = 0.5;
                config.alignmentWeight = 0.3;
                config.cohesionWeight = 0.2;
                config.maxSpeed = 8.0;
                config.wanderWeight = 1.5;
                break;

            case 'tight':
                config.separationWeight = 2.0;
                config.alignmentWeight = 2.0;
                config.cohesionWeight = 2.5;
                config.separationDistance = 15;
                config.maxSpeed = 2.5;
                config.wanderWeight = 0.0;
                break;

            case 'exploration':
                config.separationWeight = 1.0;
                config.alignmentWeight = 0.8;
                config.cohesionWeight = 0.5;
                config.maxSpeed = 5.0;
                config.wanderWeight = 0.8;
                break;
        }

        this.gui.controllersRecursive().forEach(controller => controller.updateDisplay());
    }

    /**
     * Trigger HKUST story mode
     */
    private triggerStoryMode(): void {
        if (!this.storyController) return;

        const recommended = this.storyController.getRecommendedDroneCount();
        if (this.boidSystem.boids.length !== recommended) {
            this.boidSystem.initializeBoids(recommended);
            this.scene.rebuildInstancedMesh(recommended);
        }
        this.storyController.initialize();
        this.storyController.startStory();
    }

    /**
     * Setup performance statistics panel
     */
    private setupStats(): void {
        this.statsElement = document.createElement('div');
        this.statsElement.style.position = 'fixed';
        this.statsElement.style.top = '10px';
        this.statsElement.style.right = '10px';
        this.statsElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.statsElement.style.color = '#0f0';
        this.statsElement.style.fontFamily = 'monospace';
        this.statsElement.style.fontSize = '12px';
        this.statsElement.style.padding = '10px';
        this.statsElement.style.borderRadius = '5px';
        this.statsElement.style.minWidth = '200px';
        this.statsElement.style.zIndex = '1000';
        document.body.appendChild(this.statsElement);
    }

    /**
     * Update performance statistics
     */
    updateStats(fps: number): void {
        const stats = this.boidSystem.getStats();

        this.statsElement.innerHTML = `
      <div style="color: #ff0; font-size: 14px; margin-bottom: 5px;">⚡ Performance Monitor</div>
      <div>FPS: <span style="color: #0ff">${fps.toFixed(1)}</span></div>
      <div>Drone Count: <span style="color: #0ff">${stats.boidCount}</span></div>
      <div>Update Time: <span style="color: #0ff">${stats.updateTime.toFixed(2)}ms</span></div>
      <div>Neighbor Search: <span style="color: #0ff">${stats.neighborSearchTime.toFixed(2)}ms</span></div>
      <div>Force Calculation: <span style="color: #0ff">${stats.forceCalculationTime.toFixed(2)}ms</span></div>
      <div>Avg Neighbors: <span style="color: #0ff">${stats.avgNeighbors.toFixed(1)}</span></div>
      <div>Spatial Cells: <span style="color: #0ff">${stats.cellCount}</span></div>
      <div>Avg Density: <span style="color: #0ff">${stats.avgBoidsPerCell.toFixed(1)}</span></div>
      <div>Max Density: <span style="color: #0ff">${stats.maxBoidsInCell}</span></div>
    `;
    }

    /**
     * Export configuration
     */
    private exportConfig(): void {
        const json = this.boidSystem.exportConfig();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `boid-config-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('Configuration exported');
    }

    /**
     * Import configuration
     */
    private importConfig(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const json = event.target?.result as string;
                    this.boidSystem.importConfig(json);
                    this.gui.controllersRecursive().forEach(controller => controller.updateDisplay());
                    console.log('Configuration imported');
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    /**
     * Destroy GUI
     */
    destroy(): void {
        this.gui.destroy();
        this.statsElement.remove();
    }
}

