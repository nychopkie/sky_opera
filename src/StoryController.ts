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

type StoryScene = 'inactive' | 'scene01_idle' | 'scene02_split' | 'scene1_conv' | 'scene2_shape' | 'scene3_coolShape' | 'scene4_circle' ;

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
            b.position.set(0, 0, 0);
            b.velocity.set(0, 0, 0);

            if (index < this.config.initialBoidCount) {
                this.initialBoids.push(b);
                b.isVisible = true;
                b.lightIntensity = 1.0; // 初始组直接点亮
            } else {
                this.backgroundBoids.push(b);
                b.isVisible = true; // 先设置为可见，但灯光为0，在黑暗中不可见
                b.lightIntensity = 0.0;
            }
            b.storyTarget = new Vector3(); // 为每个boid初始化storyTarget
        });

        this.currentScene = 'scene01_idle';
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
            case 'scene01_idle':
                this.updateScene0_idle();
                if (this.sceneTime >= 5) {
                    this.currentScene = 'scene02_split';
                    this.sceneTime = 0;
                    this.assignGroupsForScene0();
                }
                break;
            case 'scene02_split':
                this.updateScene0_split();
                if (this.sceneTime >= 5) {
                    this.currentScene = 'scene1_conv';
                    this.sceneTime = 0;
                }
                break;
            case 'scene1_conv':
                this.updateScene1_conv();
                if (this.sceneTime >= this.config.scene1_duration) {
                    this.currentScene = 'scene2_shape';
                    this.sceneTime = 0;
                }
            case 'scene2_shape':
                this.updateScene2_shape();
                if (this.sceneTime >= this.config.scene2_duration) {
                    this.currentScene = 'scene3_coolShape';
                    this.sceneTime = 0;
                }
                break;
            case 'scene3_coolShape':
                this.updateScene3_coolShape();
                if (this.sceneTime >= this.config.scene3_duration) {
                    this.currentScene = 'scene4_circle';
                    this.sceneTime = 0;
                }
                break;
            case 'scene4_circle':
                this.updateScene4_circle();
                if (this.sceneTime >= this.config.scene4_duration) {
                    this.stop(); // 故事结束
                }
                break;
        }
    }
    
    // here start the scene update methods
    // ============================================================================
    private updateScene0_idle(): void {
        // set a small value for each boid as the target to keep them hovering in place
        this.boidSystem.boids.forEach(b => {
            b.storyTarget!.set(
                b.position.x + (Math.random() - 0.5) * 10,
                b.position.y + (Math.random() - 0.5) * 10,
                b.position.z + (Math.random() - 0.5) * 10
            );
        });
    }

    // split into groups according to the config, with initial boids in each group according to ratio
    private assignGroupsForScene0(): void {
        let boidIndex = 0;
        this.config.groups.forEach(group => {
            const groupSize = Math.floor(this.config.totalBoidCount * group.ratio);
            for (let i = 0; i < groupSize && boidIndex < this.config.totalBoidCount; i++) {
                const boid = this.boidSystem.boids[boidIndex];
                if (boid) {
                    boid.groupData = group; // 将分组信息附加到boid上
                }
                boidIndex++;
            }
        });

        // 将剩余的boids分配给最大的组
        const largestGroup = this.config.groups.reduce((a, b) => a.ratio > b.ratio ? a : b);
        for (; boidIndex < this.config.totalBoidCount; boidIndex++) {
            this.boidSystem.boids[boidIndex].groupData = largestGroup;
        }
    }

    private updateScene0_split(): void {
        const numGroups = this.config.groups.length;
        this.boidSystem.boids.forEach(boid => {
            if (boid.groupData) {
                const groupIndex = this.config.groups.indexOf(boid.groupData);
                const angle = (groupIndex / numGroups) * Math.PI * 2;

                const centerOfMass = boid.storyTarget!.clone(); // 从上一场景的位置开始
                const targetPos = new Vector3(
                    Math.cos(angle) * 300,
                    200,
                    Math.sin(angle) * 300
                );

                // 从花朵形态平滑过渡到分组形态
                const progress = this.sceneTime / 10;
                boid.storyTarget = centerOfMass.lerp(targetPos, progress);
                boid.color.set(boid.groupData.color);
            }
        });
    }

    // ============================================================================
    private updateScene1_conv(): void {
        // 场景1：无人机缓慢聚拢到中心位置
        // ligth up all the initial boids
        this.initialBoids.forEach(b => {
            b.isVisible = true;
        });

        const center = new Vector3(0, 250, 0);
        this.boidSystem.boids.forEach(b => {
            const progress = this.sceneTime / 5;
            const centerOfMass = b.storyTarget!.clone(); // 从上一场景的位置开始
            b.storyTarget = centerOfMass.lerp(center, progress);
            b.lightIntensity = Math.min(b.lightIntensity + 0.01, 1.0); // 渐亮
        });
    }

    // ============================================================================
    private updateScene2_shape(): void {
        // 场景2：无人机形成一个特定形状（flower）
        const shapeCenter = new Vector3(0, 250, 0);
        const radius = 100;
        const angleStep = (2 * Math.PI) / this.initialBoids.length;
        this.initialBoids.forEach((b, index) => {
            const angle = index * angleStep;
            b.storyTarget!.set(
                shapeCenter.x + radius * Math.cos(angle),
                shapeCenter.y,
                shapeCenter.z + radius * Math.sin(angle)
            );
        });
    }

    // ============================================================================
    private updateScene3_coolShape(): void {
        const progress = this.sceneTime / this.config.scene2_duration;
        this.boidSystem.boids.forEach((boid, i) => {
            // outline of shenzheng coordinates (simplified)
            const angle = (i / this.initialBoids.length) * Math.PI * 2;
            const radius = 200;
            const targetX = radius * Math.cos(angle);
            const targetY = 150 + Math.sin(angle * 3) * 50; // some vertical variation
            const targetZ = radius * Math.sin(angle);
            boid.storyTarget = new Vector3();
            boid.storyTarget!.set(targetX, targetY, targetZ);
            boid.isVisible = true;

            // the light intensity is pulsing
            boid.lightIntensity = Math.sin(progress * Math.PI * 4 + (i / this.boidSystem.boids.length) * Math.PI * 2) * 0.5 + 0.5;
        });
    }

    // ============================================================================
    private updateScene4_circle(): void {
        const center = new Vector3(0, 250, 0);
        const radius = 150;
        const angleStep = (2 * Math.PI) / this.boidSystem.boids.length;

        this.boidSystem.boids.forEach((boid, index) => {
            const angle = index * angleStep + (this.sceneTime * 0.5); // 添加时间因子实现旋转效果
            boid.storyTarget!.set(
                center.x + radius * Math.cos(angle),
                center.y + radius * Math.sin(angle),
                center.z
            );

            const progress = this.sceneTime / this.config.scene4_duration;

            boid.lightIntensity = Math.sin(progress * Math.PI * 4 + (index / this.boidSystem.boids.length) * Math.PI * 2) * 0.5 + 0.5;
        });
    }
}
