import { min } from 'three/webgpu';
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
    scene1_duration: number;
    scene2_duration: number;
    scene3_duration: number;
    scene4_duration: number;
}

// type StoryScene = 'inactive' | 'scene1_spiral' | 'scene2_expand' | 'scene3_split';
// type StoryScene = 'inactive' | 'scene1_split' | 'scene2_join' | 'scene3_expand' | 'scene4_shapes' | 'scene5_split';
type StoryScene = 'inactive' | 'scene0_initPos' |'scene1_scattered' | 'scene2_formOutline' | 'scene3_expand' | 'scene4_factory' ;

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
        this.currentScene = 'scene0_initPos';
        this.sceneTime = 0;
    }

    public stop(): void {
        this.currentScene = 'inactive';
        this.boidSystem.boids.forEach(b => {
            b.storyTarget = null;
            b.lightIntensity = 0.0; // close all light when end
        });
        this.initialBoids = [];
        this.backgroundBoids = [];
    }

    public update(deltaTime: number): void {
        if (this.currentScene === 'inactive') return;

        this.sceneTime += deltaTime;

        switch (this.currentScene) {
            case 'scene0_initPos':
                this.updateScene0_InitPos();
                if (this.sceneTime >= 5.0) { // wait for 5 seconds
                    this.currentScene = 'scene1_scattered';
                    this.sceneTime = 0;
                }
                break;
            case 'scene1_scattered':
                this.updateScene1_Scattered();
                if (this.sceneTime >= this.config.scene1_duration) {
                    this.currentScene = 'scene2_formOutline';
                    this.sceneTime = 0;
                }
                break;
            case 'scene2_formOutline':
                this.updateScene2_FormOutline();
                if (this.sceneTime >= this.config.scene2_duration) {
                    this.currentScene = 'scene3_expand';
                    this.sceneTime = 0;
                }
                break;
            case 'scene3_expand':
                this.updateScene3_Expand();
                if (this.sceneTime >= this.config.scene3_duration) {
                    this.currentScene = 'scene4_factory';
                    this.sceneTime = 0;
                }
                break;
            case 'scene4_factory':
                this.updateScene4_Factory();
                if (this.sceneTime >= this.config.scene4_duration) {
                    this.stop(); // 故事结束
                }
                break;
        }
    }
    
    // here start the scene update methods
    // ================================ SCENE 0 ================================
    private updateScene0_InitPos(): void {
        // In this scene, boids fly to initial position from 0,0,0
        this.boidSystem.boids.forEach((boid) => {
            const targetX = Math.random() * 200 * Math.sign(Math.random() - 0.5);
            const targetY = Math.random() * 200; // Keep them above ground
            const targetZ = Math.random() * 200 * Math.sign(Math.random() - 0.5);
            // move slowly to scattered position from previous position according to progress
            boid.storyTarget!.set(targetX, targetY, targetZ);
        });
    }

    // ================================ SCENE 1 ================================
    // boids in a scattered position, not doing swarm behaviors yet
    // also pulse with breathing light >> sin function period
    private updateScene1_Scattered(): void {
        // scatter for all boids
        this.boidSystem.boids.forEach((boid, i) => {
            const progress = this.sceneTime / this.config.scene1_duration

            // change the visibility according to progress
            if (progress > 0.1) {
                // only show initial boids
                if (i < this.config.initialBoidCount) {
                    boid.isVisible = true;
                } else {
                    boid.isVisible = false;
                }
                // boid.velocity.set(0, 0, 0);
                boid.storyTarget = null;
            }

            // the light of the boids have a breathing effect (periodic change)
            // the light should range from 0 to 1 periodically
            boid.lightIntensity = Math.sin(progress * Math.PI * this.config.scene1_duration/5 + 3* Math.PI/2 * i/this.boidSystem.boids.length) * 0.5 + 0.5; // fade in effect
        });
    }

    // ================================ SCENE 2 ================================
    // form 
    private updateScene2_FormOutline(): void {
        // to stop motions >> set the velocity to 0 after arriving at target
        // form shape of shenzheng
        // form outline using the initialBoids only, others stay invisible aka intensity 0
        const progress = this.sceneTime / this.config.scene2_duration;
        this.initialBoids.forEach((boid, i) => {
            // outline of shenzheng coordinates (simplified)
            // just make an oval shape for now 
            const angle = (i / this.initialBoids.length) * Math.PI * 2;
            const radius = 100;
            const targetX = 10 + 200 * Math.cos(angle);
            const targetY = 30 + radius * Math.sin(angle)+ 200; // some vertical variation
            const targetZ = 0;
            boid.storyTarget = new Vector3();
            // go to position
            boid.storyTarget!.set(targetX, targetY, targetZ);
            boid.isVisible = true;
            // slowly increase light intensity from current to 1.0
            boid.lightIntensity = Math.min(1.0, boid.lightIntensity + progress * 0.1);
        });

        // background boids remain invisible
        this.backgroundBoids.forEach((boid) => {
            boid.isVisible = false;
            boid.lightIntensity = 0.0;
            boid.storyTarget = new Vector3();
            // move to shekou
            boid.storyTarget!.set(
                10 - 200 * 0.8, 
                200 + 30 - 100 * 0.8, 
                0);
        });
    }

    // ================================ SCENE 3 ================================
    // shekou expand shere with increasing pulsing light
    private updateScene3_Expand(): void {
        // background boids expand outward in a sphere
        const progress = this.sceneTime / this.config.scene3_duration;
        const radius = 400 * progress;
        this.backgroundBoids.forEach((boid, i) => {
            boid.isVisible = true;
            const phi = Math.acos(-1 + (2 * i) / this.config.totalBoidCount);
            const theta = Math.sqrt(this.config.totalBoidCount * Math.PI) * phi;

            // expand at their current position
            boid.storyTarget!.set(
                radius * Math.cos(theta) * Math.sin(phi) + 10 - 200 * 0.8,
                10 + radius * Math.sin(theta) * Math.sin(phi) + 200 + 30 - 100 * 0.8,
                0
            );

            // increase light increase in a sinusoidal manner with period getting shorter
            boid.lightIntensity = Math.sin(progress * Math.PI * 10 * 5 * progress + 3* Math.PI/2 * i/this.boidSystem.boids.length) * 0.5 + 0.5; // fade in effect
        });
    }

    // ================================ SCENE 4 ================================
    // should be factory, but i put square as placeholder for now
    private updateScene4_Factory(): void {
        // all boids move to form a square factory shape
        const progress = this.sceneTime / this.config.scene4_duration;
        const factorySize = 150;
        this.backgroundBoids.forEach((boid, i) => {
            // calculate position in a square grid
            const perSide = Math.ceil(Math.sqrt(this.config.totalBoidCount));
            const row = Math.floor(i / perSide);
            const col = i % perSide;
            const targetX = (col - perSide / 2) * (factorySize / perSide);
            const targetY = (row - perSide / 2) * (factorySize / perSide) + 50;
            const targetZ = 0;
            boid.storyTarget!.set(targetX, targetY, targetZ);
            boid.isVisible = true;
            boid.lightIntensity = 1.0;
        });
        // use initial boids to form smokestacks
        const smokestackHeight = 200;
        const smokestackWidth = 20;
        this.initialBoids.forEach((boid, i) => {
            // ]basically the factory chimney is just a rectangle on top of the square
            const stacksPerSide = Math.ceil(Math.sqrt(this.initialBoids.length));
            const row = Math.floor(i / stacksPerSide);
            const col = i % stacksPerSide;
            const targetX = smokestackHeight / 2 - 20;
            const targetY = (col - stacksPerSide / 2) * smokestackWidth * 2;
            const targetZ = 0;
            boid.storyTarget!.set(targetX, targetY, targetZ);
            boid.isVisible = true;
            boid.lightIntensity = 1.0;
        });

    }


}