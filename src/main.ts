import './style.css';
import { BoidSystem } from './BoidSystem';
import { BoidConfig } from './BoidConfig';
import { Scene } from './Scene';
import { Controls } from './Controls';
import { StoryController, StoryConfig } from './StoryController';
import { Color } from 'three';

/**
 * Main application entry point
 */
class App {
    private boidSystem: BoidSystem;
    private scene: Scene;
    private controls: Controls;
    private storyController: StoryController;

    private animationId?: number;
    private lastTime = performance.now();
    private fps = 60;

    constructor() {
        // Initialize configuration
        const config = new BoidConfig();
        config.bounds.min.set(-500, 0, -500);
        config.bounds.max.set(500, 800, 500);
        config.maxSpeed = 1.0;

        // set the drone size to be larger for better visibility
        config.droneSize = 2.0;

        // Initialize system
        this.boidSystem = new BoidSystem(config);
        this.boidSystem.initializeBoids(1000); // Default 1000 drones

        // Initialize scene
        const container = document.getElementById('app')!;
        this.scene = new Scene(container, this.boidSystem);

        // Initialize control panel
        this.controls = new Controls(this.boidSystem, this.scene);

        // Initialize Story Controller
        const groupRatios = [
            0.337, 0.118, 0.107, 0.079, 0.066,
            0.065, 0.056, 0.032, 0.022, 0.017,
            0.016, 0.015, 0.015, 0.007, 0.007,
            0.006, 0.005, 0.005, 0.004, 0.004,
            0.004, 0.003, 0.002, 0.002, 0.006
        ];

        // Use an explicit list of hex colors (one per group) so colors are deterministic
        const groupHexColors: number[] = [
            0xFF3B30, 0xFF9500, 0xFFCC00, 0xFFD455, 0xAAFF00,
            0x00FF5E, 0x00D4FF, 0x007AFF, 0x4B0082, 0x7F00FF,
            0xFF00C8, 0xFF66B2, 0xFF99A4, 0xFFB347, 0xFF7F50,
            0xCD5C5C, 0x8B4513, 0x2E8B57, 0x20B2AA, 0x4682B4,
            0x6A5ACD, 0x9400D3, 0xDC143C, 0xFF1493, 0xFF69B4
        ];

        const groups = groupRatios.map((ratio, i) => {
            const hex = groupHexColors[i % groupHexColors.length];
            const color = new Color(hex);
            return { ratio, color };
        });

        const storyConfig: StoryConfig = {
            totalBoidCount: 1000, // 17189 / 20
            initialBoidCount: 100, // 700 / 20
            groups: groups,
            scene1_duration: 30,
            scene2_duration: 10,
            scene3_duration: 20,
            scene4_duration: 30,
        };
        this.storyController = new StoryController(this.boidSystem, storyConfig);

        // Add story mode button to controls
        this.controls.addStoryModeButton(this.storyController);

        // Start animation loop
        this.animate();

        // Show welcome message
        this.showWelcome();
    }

    /**
     * Animation loop
     */
    private animate = (): void => {
        this.animationId = requestAnimationFrame(this.animate);

        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;

        // Update FPS (smooth processing)
        this.fps = this.fps * 0.9 + (1000 / deltaTime) * 0.1;

        // Update Story Controller
        this.storyController.update(deltaTime / 1000); // Convert ms to seconds

        // Update Boid system
        this.boidSystem.update();

        // Render scene
        this.scene.render();

        // Update stats every 30 frames
        if (Math.floor(currentTime / 500) !== Math.floor(this.lastTime / 500)) {
            this.controls.updateStats(this.fps);
        }

        this.lastTime = currentTime;
    };

    /**
     * Show welcome message
     */
    private showWelcome(): void {
        const welcome = document.createElement('div');
        welcome.style.position = 'fixed';
        welcome.style.top = '50%';
        welcome.style.left = '50%';
        welcome.style.transform = 'translate(-50%, -50%)';
        welcome.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        welcome.style.color = '#fff';
        welcome.style.padding = '30px';
        welcome.style.borderRadius = '10px';
        welcome.style.fontFamily = 'Arial, sans-serif';
        welcome.style.zIndex = '10000';
        welcome.style.maxWidth = '600px';
        welcome.style.textAlign = 'center';

        welcome.innerHTML = `
      <h1 style="margin: 0 0 20px 0; color: #ff3366;">🚁 Drone Swarm Boid Simulation System</h1>
      <p style="line-height: 1.6; margin-bottom: 15px;">
        This is a thousand-scale drone 3D swarm behavior simulation system based on the Boid algorithm.<br>
        You can adjust various parameters through the control panel on the right to explore different swarm behavior patterns.
      </p>
      <div style="text-align: left; margin: 20px 0; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 5px;">
        <strong>🎮 Controls Guide:</strong><br>
        • <strong>Mouse drag</strong> - Rotate view<br>
        • <strong>Scroll wheel</strong> - Zoom distance<br>
        • <strong>Right panel</strong> - Adjust parameters<br>
        • <strong>Preset modes</strong> - Quick experience different modes
      </div>
      <div style="text-align: left; margin: 20px 0; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 5px;">
        <strong>⚙️ Core Parameters:</strong><br>
        • <strong>Separation</strong> - Avoid crowding<br>
        • <strong>Alignment</strong> - Direction consistency<br>
        • <strong>Cohesion</strong> - Maintain gathering<br>
        • <strong>Wander</strong> - Random exploration
      </div>
      <button id="startBtn" style="
        background: linear-gradient(135deg, #ff3366, #ff6699);
        border: none;
        color: white;
        padding: 15px 40px;
        font-size: 16px;
        border-radius: 25px;
        cursor: pointer;
        margin-top: 10px;
        font-weight: bold;
        box-shadow: 0 4px 15px rgba(255, 51, 102, 0.4);
        transition: all 0.3s;
      ">Start Exploring</button>
    `;

        document.body.appendChild(welcome);

        const startBtn = document.getElementById('startBtn')!;
        startBtn.addEventListener('mouseenter', () => {
            startBtn.style.transform = 'scale(1.05)';
            startBtn.style.boxShadow = '0 6px 20px rgba(255, 51, 102, 0.6)';
        });
        startBtn.addEventListener('mouseleave', () => {
            startBtn.style.transform = 'scale(1)';
            startBtn.style.boxShadow = '0 4px 15px rgba(255, 51, 102, 0.4)';
        });
        startBtn.addEventListener('click', () => {
            welcome.style.transition = 'opacity 0.5s';
            welcome.style.opacity = '0';
            setTimeout(() => welcome.remove(), 500);
        });
    }

    /**
     * Stop animation
     */
    stop(): void {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}

// Start application
new App();

