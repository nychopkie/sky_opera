import { Boid } from './Boid';
import { BoidSystem } from './BoidSystem';
import { Vector3, Color } from 'three';

// 可复用的故事配置接口
export interface StoryConfig {
    totalBoidCount: number;
    initialBoidCount: number;
    // 定义最终分成的组及其比例和颜色
    groups: { ratio: number; color: Color }[];
    // 场景参数
    scene1_duration: number;
    scene2_duration: number;
    scene3_duration: number;
    scene4_duration: number;
}

type StoryScene = 'inactive' | 'scene1_linesPulse' | 'scene2_5g' | 'scene3_chips' | 'scene4_whirlpoolSwarm';

/**
 * 这是一个用于控制无人机群表演特定故事的控制器。
 * 它的设计是可复用的，只需提供不同的 `StoryConfig` 即可实现不同的故事。
 *
 * 实现原理：
 * 1. 状态机：内部通过一个简单的状态机 (`currentScene`) 来管理故事的三个阶段。
 * 2. 时间驱动：每个场景都有一个持续时间 (`sceneTime`)，当时间到达后会自动切换到下一个场景。
 * 3. 目标驱动：在每个场景中，控制器会为每个无人机计算一个特定的 `storyTarget`（目标位置）。
 *    - Boid 类本身的行为被修改为：当 `storyTarget` 存在时，它会产生一个强烈的、朝向该目标的力。
 *      这使得我们可以精确地控制无人机形成各种队形（螺旋、花朵、分组等），同时保留一些基础的群体行为。
 * 4. 视觉控制：控制器会直接修改 Boid 的 `isVisible` 和 `lightIntensity` 属性，
 *    这些属性随后被 `Scene.ts` 中的渲染器用来控制无人机的显示效果（是否可见、灯光亮度）。
 * 5. 配置化：所有的关键参数（如无人机数量、半径、高度、颜色等）都被提取到 `StoryConfig` 中，
 *    使得用户可以轻松地调整这些参数来复用此故事模板，讲述一个不同的、但结构相似的故事。
 */
export class StoryController {
    private boidSystem: BoidSystem;
    private config: StoryConfig;
    private currentScene: StoryScene = 'inactive';
    private sceneTime: number = 0;
    private initialBoids: Boid[] = [];
    private backgroundBoids: Boid[] = [];

    constructor(boidSystem: BoidSystem, config: StoryConfig) {
        this.boidSystem = boidSystem;
        this.config = config;
    }

    public start(): void {
        this.boidSystem.initializeBoids(this.config.totalBoidCount);
        this.boidSystem.boids.forEach((b, index) => {
            // 所有无人机从地面中心开始
            b.position.set(0, 250, 0);
            b.velocity.set(0, 0, 0);

            if (index < this.config.initialBoidCount) {
                this.initialBoids.push(b);
                b.isVisible = true;
                b.lightIntensity = 0.0; // 初始组直接点亮
            } else {
                this.backgroundBoids.push(b);
                b.isVisible = true; // 先设置为可见，但灯光为0，在黑暗中不可见
                b.lightIntensity = 0.0;
            }
            b.storyTarget = new Vector3(); // 为每个boid初始化storyTarget
        });

        this.currentScene = 'scene1_linesPulse';
        this.sceneTime = 0;
    }

    public stop(): void {
        this.currentScene = 'inactive';
        this.boidSystem.boids.forEach(b => {
            b.storyTarget = null;
            b.lightIntensity = 1.0;
        });
        this.initialBoids = [];
        this.backgroundBoids = [];
    }

    public update(deltaTime: number): void {
        if (this.currentScene === 'inactive') return;

        this.sceneTime += deltaTime;

        switch (this.currentScene) {
            case 'scene1_linesPulse':
                this.updateScene1_LinesPulse();
                if (this.sceneTime >= this.config.scene1_duration) {
                    this.currentScene = 'scene2_5g';
                    this.sceneTime = 0;
                }
                break;
            case 'scene2_5g':
                this.updateScene2_5g();
                if (this.sceneTime >= this.config.scene2_duration) {
                    this.currentScene = 'scene3_chips';
                    this.sceneTime = 0;
                }
                break;
            case 'scene3_chips':
                this.updateScene3_Chips();
                if (this.sceneTime >= this.config.scene3_duration) {
                    this.currentScene = 'scene4_whirlpoolSwarm';
                    this.sceneTime = 0;
                }
                break;
            case 'scene4_whirlpoolSwarm':
                this.updateScene4_WhirlpoolSwarm();
                if (this.sceneTime >= this.config.scene4_duration) {
                    this.stop(); // 故事结束
                }
                break;
        }
    }
    
    // here start the scene update methods
    // ================================ SCENE 1 ================================
    // basically in a sense, boids would need to be assigned to designated groups first, then pulse one by one
    private updateScene1_LinesPulse(): void {
        // split all boids into 8 equal sized groups
        // for now make 8 groups equally sized
        const totalBoids = this.boidSystem.boids.length;
        // assign groups for all boids
        // for now make 8 groups equally sized
        const groups: Boid[][] = Array.from({ length: 8 }, () => []);
        this.boidSystem.boids.forEach((b, index) => {
            const groupIndex = Math.floor((index / totalBoids) * 8);
            groups[groupIndex].push(b);
        });

        // draw the lines like rays coming from the center
        const center = new Vector3(0, 250, 0);
        const radius = 200;
        const angleStep = (2 * Math.PI) / 8;
        groups.forEach((group, groupIndex) => {
            const angle = groupIndex * angleStep;
            const lineDirection = new Vector3(
                Math.cos(angle), 
                Math.sin(angle), 
                0);
            group.forEach((boid, boidIndex) => {
                const t = boidIndex / group.length;
                const targetPosition = center.clone().add(lineDirection.clone().multiplyScalar(radius * t));
                boid.storyTarget!.copy(targetPosition);

                // light up the boids one by one, group by group
                const pulseDuration = this.config.scene1_duration / groups.length;
                const timeInPulse = this.sceneTime - groupIndex * pulseDuration;
                if (timeInPulse >= 0 && timeInPulse < pulseDuration) {
                    boid.lightIntensity = 1.0;  
                }
            });
        });
    }

    // ================================ SCENE 2 ================================
    private updateScene2_5g(): void {
    }

    // ================================ SCENE 3 ================================
    private updateScene3_Chips(): void {
    }

    // ================================ SCENE 4 ================================
    private updateScene4_WhirlpoolSwarm(): void {   
    }
}
