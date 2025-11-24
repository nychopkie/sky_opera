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
    scene3_shapeType: string[];
    scene3_shapeRadius: number;
    scene3_duration: number;
}

// type StoryScene = 'inactive' | 'scene1_spiral' | 'scene2_expand' | 'scene3_split';
type StoryScene = 'inactive' | 'scene1_split' | 'scene2_join' | 'scene3_shapes';

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
                b.isVisible = true;
                b.lightIntensity = 1.0; // 初始组直接点亮
            } else {
                this.backgroundBoids.push(b);
                b.isVisible = true; // 先设置为可见，但灯光为0，在黑暗中不可见
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
                    this.currentScene = 'scene3_shapes';
                    this.sceneTime = 0;
                }
                break;
            case 'scene3_shapes':
                this.updateScene3_Shape();
                if (this.sceneTime >= this.config.scene3_duration) {
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
                    center.y + (this.config.scene1_spiralHeight || 0) * (i / Math.max(1, groupBoids.length)),
                    center.z + radius * Math.sin(theta)
                );

                // Smoothly interpolate existing storyTarget toward the spiral target
                boid.storyTarget = boid.storyTarget!.lerp(targetPos, progress);
                // make group visible and set light/color
                // boid.isVisible = true;
                // if (boid.groupData && boid.groupData.color) boid.color = boid.groupData.color;
                // // slightly increase light for visible group members
                // boid.lightIntensity = 0.8;
            }
        }
    }

    // ================================ SCENE 2 ================================
    // scene req: each groups of swarms joins in the center, and while travelling to the center gradually light up. Center is spiralling
    private updateScene2_Join(): void {
        const progress = this.sceneTime / this.config.scene2_duration;
        // move boids to the center
        this.boidSystem.boids.forEach((boid, i) => {
            const targetPos = new Vector3(0, 10, 0);
            boid.storyTarget = boid.storyTarget!.lerp(targetPos, progress);

            // 背景组的无人机在此场景中逐渐亮起
            if (i >= this.config.initialBoidCount) {
                boid.lightIntensity = Math.min(1.0, progress); // 进度过半时完全点亮
            }
        });
    }

    // ================================ SCENE 3 ================================
    // scene req: the swarm then breaks, and each boid would pause having swarming behaviours and form shapes according to the cooridinates assigned to them
    private updateScene3_Shape(): void {
        // will show the shapes defined in config
        // boids stop jittering and go to separate coordinates to form shapes
        // in a sense, this stops the boids from flocking behavior and just go to target positions
        const progress = this.sceneTime / this.config.scene3_duration;
        const numShapes = this.config.scene3_shapeType.length;
        this.boidSystem.boids.forEach((boid, i) => {
            const shapeIndex = i % numShapes;
            const shapeType = this.config.scene3_shapeType[shapeIndex];
            const radius = this.config.scene3_shapeRadius;
            const anglePerBoid = (2 * Math.PI) / Math.floor(this.boidSystem.boids.length / numShapes);
            const theta = anglePerBoid * Math.floor(i / numShapes);
            
            // boid configs o behaviour: stop flocking of the boid, go to target positions
            this.boidSystem.config.enableFlocking = false;
            
            let targetPos = new Vector3();
            switch (shapeType) {
                case 'circle':
                    targetPos.set(
                        radius * Math.cos(theta),
                        10,
                        radius * Math.sin(theta)
                    );
                    break;
                // Add other shape cases here
                case 'square':
                    targetPos.set(
                        radius * (Math.cos(theta) >= 0 ? 1 : -1),
                        10,
                        radius * (Math.sin(theta) >= 0 ? 1 : -1)
                    );
                    break;
                case 'triangle':
                    targetPos.set(
                        radius * (Math.cos(theta) >= 0 ? 1 : -1) * (1 - Math.abs(Math.sin(theta))),
                        10,
                        radius * (Math.sin(theta) >= 0 ? 1 : -1) * (1 - Math.abs(Math.cos(theta)))
                    );
                    break;
                case 'pentagon':
                    targetPos.set(
                        radius * Math.cos(theta) * (Math.abs(Math.cos(theta)) + Math.abs(Math.sin(theta))) / 2,
                        10,
                        radius * Math.sin(theta) * (Math.abs(Math.cos(theta)) + Math.abs(Math.sin(theta))) / 2
                    );
                    break;
                case 'hexagon':
                    targetPos.set(
                        radius * Math.cos(theta) * (Math.abs(Math.cos(theta)) + Math.abs(Math.sin(theta))) / 1.5,
                        10,
                        radius * Math.sin(theta) * (Math.abs(Math.cos(theta)) + Math.abs(Math.sin(theta))) / 1.5
                    );
                    break;
            }

            // Smoothly interpolate to the target position
            boid.storyTarget = boid.storyTarget!.lerp(targetPos, progress);
        });
    }
}