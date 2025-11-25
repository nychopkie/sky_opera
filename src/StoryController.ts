import { Boid } from './Boid';
import { BoidSystem } from './BoidSystem';
import { Vector3, Color } from 'three';
// import { BoidConfig } from './BoidConfig';

// 可复用的故事配置接口
export interface StoryConfig {
    totalBoidCount: number;
    initialBoidCount: number;
    // 定义最终分成的组及其比例和颜色
    groups: { ratio: number; color: Color }[];
    // 场景参数
    scene1_spiralHeight: number
    scene1_splitApartDistance: number;
    scene1_duration: number;
    scene2_joinDistance: number;
    scene2_duration: number;
    scene3_expansionRadius: number;
    scene3_duration: number;
    scene4_shapeRadius: number;
    scene4_duration: number;
    scene5_splitApartDistance: number;
    scene5_duration: number;
}

// type StoryScene = 'inactive' | 'scene1_spiral' | 'scene2_expand' | 'scene3_split';
type StoryScene = 'inactive' | 'scene1_split' | 'scene2_join' | 'scene3_expand' | 'scene4_shapes' | 'scene5_split';

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
    // Groups organized for scene1 (array of arrays of Boids)
    private groups: Boid[][] = [];

    constructor(boidSystem: BoidSystem, config: StoryConfig) {
        this.boidSystem = boidSystem;
        this.config = config;
    }

    public start(): void {
        this.boidSystem.initializeBoids(this.config.totalBoidCount);
        this.boidSystem.boids.forEach((b, index) => {
            // 所有无人机从地面中心开始
            // but starting should be seaprate
            // aka set different position 
            // shoud
            b.position.set(0, 0, 0);
            b.velocity.set(0, 0, 0);

            if (index < this.config.initialBoidCount) {
                this.initialBoids.push(b);
                b.isVisible = false;
                b.lightIntensity = 1.0; // 初始组直接点亮
            } else {
                this.backgroundBoids.push(b);
                b.isVisible = false; // 先设置为可见，但灯光为0，在黑暗中不可见
                b.lightIntensity = 0.0;
            }
            b.storyTarget = new Vector3(); // 为每个boid初始化storyTarget
        });

        // set initial scene
        this.currentScene = 'scene1_split';
        this.sceneTime = 0;
        this.assignGroupsForScene1();
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
            case 'scene1_split':
                this.updateScene1_Split();
                if (this.sceneTime >= this.config.scene1_duration) {
                    this.currentScene = 'scene2_join';
                    this.sceneTime = 0;
                }
                break;
            case 'scene2_join':
                this.updateScene2_Join();
                if (this.sceneTime >= this.config.scene2_duration) {
                    this.currentScene = 'scene3_expand';
                    this.sceneTime = 0;
                }
                break;
            case 'scene3_expand':
                this.updateScene3_Expand();
                if (this.sceneTime >= this.config.scene3_duration) {
                    this.currentScene = 'scene4_shapes';
                    this.sceneTime = 0;
                }
                break;
            case 'scene4_shapes':
                this.updateScene4_Shape();
                if (this.sceneTime >= this.config.scene4_duration) {
                    this.currentScene = 'scene5_split';
                    this.sceneTime = 0;
                    this.assignGroupsForScene5();
                }
                break;
            case 'scene5_split':
                this.updateScene5_Split();
                if (this.sceneTime >= this.config.scene5_duration) {
                    this.stop(); // 故事结束
                }
                break;
        }
    }
    
    // here start the scene update methods
    // ================================ SCENE 1 ================================
    // scene req: separate groups of swarms, each group is spiraling
    // grouping would need to have some bg boids and initial boids in each group
    private assignGroupsForScene1(): void {
        const numGroups = this.config.groups.length;
        if (numGroups === 0) return;

        // Assign groups by index modulo number of groups
        const maxBoids = Math.min(this.config.totalBoidCount, this.boidSystem.boids.length);
        for (let i = 0; i < maxBoids; i++) {
            const boid = this.boidSystem.boids[i];
            if (!boid) continue;
            const groupIndex = i % numGroups;
            boid.groupData = this.config.groups[groupIndex];
            // propagate color if present
            if (boid.groupData && boid.groupData.color) boid.color = boid.groupData.color;
        }
        
    }
    
    private updateScene1_Split(): void {
        // scene req: separate groups of swarms, each group is spiraling
        const progress = Math.min(1, this.sceneTime / Math.max(0.0001, this.config.scene1_duration));

        // Build groups if not yet built
        if (this.groups.length === 0) {
            const numGroups = this.config.groups.length;
            this.groups = new Array(numGroups).fill(0).map(() => [] as Boid[]);
            this.boidSystem.boids.forEach(b => {
                const group = this.config.groups.findIndex(g => g === b.groupData);
                const gi = Math.max(0, group);
                this.groups[gi].push(b);
                // assign color from group data if available
                if (b.groupData && b.groupData.color) b.color = b.groupData.color;
            });
        }

        const numGroups = this.groups.length || 1;

        // For each group compute a center placed on a circle around origin
        for (let g = 0; g < numGroups; g++) {
            const groupBoids = this.groups[g];
            if (!groupBoids || groupBoids.length === 0) continue;

            const angleAround = (2 * Math.PI * g) / numGroups;
            const center = new Vector3(
                Math.cos(angleAround) * this.config.scene1_splitApartDistance,
                10,
                Math.sin(angleAround) * this.config.scene1_splitApartDistance
            );

            // spacing controls how tightly the spiral packs; use separationDistance as baseline
            const baseSpacing = Math.max(1, 50 * 0.6);

            for (let i = 0; i < groupBoids.length; i++) {
                const boid = groupBoids[i];

                // radius grows with sqrt(i) so later boids form an expanding spiral
                const radius = baseSpacing * Math.sqrt(i + 1);

                // angular offset per boid and time-based spinning for the spiral motion
                const angularOffset = i * 0.5; // controls density along the spiral
                const spinSpeed = 2.0; // radians per second
                const theta = angularOffset + spinSpeed * this.sceneTime;

                const targetPos = new Vector3(
                    center.x + radius * Math.cos(theta),
                    center.y + g*30, // assign height according to group to have better view on ground
                    center.z + radius * Math.sin(theta)
                );

                // Smoothly interpolate existing storyTarget toward the spiral target
                boid.storyTarget = boid.storyTarget!.lerp(targetPos, progress);

                // 背景组跟随飞行，但保持熄灯
                if (i >= this.config.initialBoidCount) {
                    boid.lightIntensity = 0;
                }

                // only show boids when they arrive at their positions
                if (progress >= 0.2) {
                    boid.isVisible = true;
                }
            }
        }
    }

    // ================================ SCENE 2 ================================
    // scene req: each groups of swarms joins in the center, and while travelling to the center gradually light up. Center is spiralling
    private updateScene2_Join(): void {
        const progress = this.sceneTime / this.config.scene2_duration;
        // move boids to the center
        this.boidSystem.boids.forEach((boid, i) => {
            const targetPos = new Vector3(0, 300, 0);
            boid.storyTarget = boid.storyTarget!.lerp(targetPos, progress);

            // 背景组的无人机在此场景中逐渐亮起
            if (i >= this.config.initialBoidCount) {
                boid.lightIntensity = Math.min(1.0, Math.pow(progress,0.7)); // gradually light up
            }
        });
    }

    // ================================ SCENE 3 ================================
    private updateScene3_Expand(): void {
        const progress = this.sceneTime / this.config.scene3_duration;
        const radius = this.config.scene3_expansionRadius * progress;

        this.boidSystem.boids.forEach((boid, i) => {
            const phi = Math.acos(-1 + (2 * i) / this.config.totalBoidCount);
            const theta = Math.sqrt(this.config.totalBoidCount * Math.PI) * phi;

            boid.storyTarget!.set(
                radius * Math.cos(theta) * Math.sin(phi),
                10 + radius * Math.sin(theta) * Math.sin(phi) + 300, // Y 也有一些偏移，形成立体花朵
                radius * Math.cos(phi)
            );
        });
    }


    // ================================ SCENE 4 ================================
    // scene req: the swarm then breaks, and each boid would pause having swarming behaviours and form shapes according to the cooridinates assigned to them
    private updateScene4_Shape(): void {
        // Form a star-like shape using a polar/radial curve.
        // We'll map each boid to a point on a parametric star curve so the whole
        // swarm outlines a star. Use a smooth interpolation from current
        // storyTarget to the final shape using the scene progress.
        const total = Math.max(1, this.config.totalBoidCount);
        const progress = Math.min(1, this.sceneTime / Math.max(0.0001, this.config.scene4_duration));
        const R = this.config.scene4_shapeRadius || 50;

        // number of star lobes (5 is the common star). You can tune this via config in future.
        const lobes = 5;

        for (let i = 0; i < this.boidSystem.boids.length; i++) {
            const boid = this.boidSystem.boids[i];
            if (!boid) continue;

            // Angle around circle
            const angle = (i / total) * Math.PI * 2;

            // A simple star-like radial modulation using cosine creates sharp points.
            // r varies between ~0 and R depending on the lobes.
            const radialFactor = 0.5 + 0.5 * Math.cos(lobes * angle);
            const r = R * (0.3 + 0.7 * radialFactor); // keep minimum radius so center isn't empty

            const target = new Vector3(
                r * Math.cos(angle),
                300,
                r * Math.sin(angle)
            );

            // Smoothly move storyTarget toward the star target as scene progresses.
            if (!boid.storyTarget) boid.storyTarget = new Vector3();
            // Use lerp with progress to provide a smooth arrival; add a tiny per-boid offset
            // so they don't perfectly overlap when r is identical.
            const jitter = 0.0001 * (i % 7);
            boid.storyTarget = boid.storyTarget.lerp(target, Math.min(1, progress));

            // Show and light up boids as they move into formation
            boid.isVisible = true;
            boid.lightIntensity = Math.min(1, 0.5 + progress * 0.5);

            // keep color if group present, else default to white
            if (boid.groupData && boid.groupData.color) {
                boid.color.set(boid.groupData.color);
            }
        }
    }

    // ================================ SCENE 5 ================================
    private assignGroupsForScene5(): void {
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

    private updateScene5_Split(): void {
        const numGroups = this.config.groups.length;
        this.boidSystem.boids.forEach((boid, i) => {
            if (boid.groupData) {
                const groupIndex = this.config.groups.indexOf(boid.groupData);
                const angle = (groupIndex / numGroups) * Math.PI * 2;

                const centerOfMass = boid.storyTarget!.clone(); // 从上一场景的位置开始
                const targetPos = new Vector3(
                    Math.cos(angle) * this.config.scene5_splitApartDistance,
                    10,
                    Math.sin(angle) * this.config.scene5_splitApartDistance
                );

                // 从花朵形态平滑过渡到分组形态
                const progress = this.sceneTime / this.config.scene5_duration;
                boid.storyTarget = centerOfMass.lerp(targetPos, progress);
                boid.color.set(boid.groupData.color);
            }
        });
    }

}