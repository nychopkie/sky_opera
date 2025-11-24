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
    scene1_spiralHeight: number;
    scene1_duration: number;
    scene2_expansionRadius: number;
    scene2_duration: number;
    scene3_splitApartDistance: number;
    scene3_duration: number;
}

type StoryScene = 'inactive' | 'scene1_spiral' | 'scene2_expand' | 'scene3_split';

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
            b.position.set(0, -this.config.scene1_spiralHeight, 0);
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

        this.currentScene = 'scene1_spiral';
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
            case 'scene1_spiral':
                this.updateScene1_Spiral();
                if (this.sceneTime >= this.config.scene1_duration) {
                    this.currentScene = 'scene2_expand';
                    this.sceneTime = 0;
                }
                break;
            case 'scene2_expand':
                this.updateScene2_Expand();
                if (this.sceneTime >= this.config.scene2_duration) {
                    this.currentScene = 'scene3_split';
                    this.sceneTime = 0;
                    this.assignGroupsForScene3();
                }
                break;
            case 'scene3_split':
                this.updateScene3_Split();
                if (this.sceneTime >= this.config.scene3_duration) {
                    this.stop(); // 故事结束
                }
                break;
        }
    }
    
    // here start the scene update methods
    private updateScene1_Spiral(): void {
        const progress = this.sceneTime / this.config.scene1_duration;
        const height = -this.config.scene1_spiralHeight + progress * (this.config.scene1_spiralHeight + 10);

        this.boidSystem.boids.forEach((boid, index) => {
            const angle = index * 0.1 + this.sceneTime * 2;
            const radius = 5 + progress * 10;
            const targetX = Math.cos(angle) * radius;
            const targetZ = Math.sin(angle) * radius;
            boid.storyTarget!.set(targetX, height, targetZ);

            // 背景组跟随飞行，但保持熄灯
            if (index >= this.config.initialBoidCount) {
                boid.lightIntensity = 0;
            }
        });
    }

    private updateScene2_Expand(): void {
        const progress = this.sceneTime / this.config.scene2_duration;
        const radius = this.config.scene2_expansionRadius * progress;

        this.boidSystem.boids.forEach((boid, i) => {
            const phi = Math.acos(-1 + (2 * i) / this.config.totalBoidCount);
            const theta = Math.sqrt(this.config.totalBoidCount * Math.PI) * phi;

            boid.storyTarget!.set(
                radius * Math.cos(theta) * Math.sin(phi),
                10 + radius * Math.sin(theta) * Math.sin(phi), // Y 也有一些偏移，形成立体花朵
                radius * Math.cos(phi)
            );

            // 背景组的无人机在此场景中逐渐亮起
            if (i >= this.config.initialBoidCount) {
                boid.lightIntensity = Math.min(1.0, progress); // 进度过半时完全点亮
            }
        });
    }

    private assignGroupsForScene3(): void {
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

    private updateScene3_Split(): void {
        const numGroups = this.config.groups.length;
        this.boidSystem.boids.forEach((boid, i) => {
            if (boid.groupData) {
                const groupIndex = this.config.groups.indexOf(boid.groupData);
                const angle = (groupIndex / numGroups) * Math.PI * 2;

                const centerOfMass = boid.storyTarget!.clone(); // 从上一场景的位置开始
                const targetPos = new Vector3(
                    Math.cos(angle) * this.config.scene3_splitApartDistance,
                    10,
                    Math.sin(angle) * this.config.scene3_splitApartDistance
                );

                // 从花朵形态平滑过渡到分组形态
                const progress = this.sceneTime / this.config.scene3_duration;
                boid.storyTarget = centerOfMass.lerp(targetPos, progress);
                boid.color.set(boid.groupData.color);

                // 背景组的无人机在此场景中逐渐亮起
                if (i >= this.config.initialBoidCount) {
                boid.lightIntensity = Math.min(1.0, progress*2); // 进度过半时完全点亮
                }
            }
        });
    }
}
