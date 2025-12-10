import { Vector3 } from 'three';

/**
 * Complete Boid algorithm parameter configuration
 */
export class BoidConfig {
    // ========== Core Behavior Weights ==========
    separationWeight: number = 1.5;      // Separation weight
    alignmentWeight: number = 1.0;       // Alignment weight
    cohesionWeight: number = 1.0;        // Cohesion weight

    // ========== Perception Distances ==========
    separationDistance: number = 25;     // Separation perception distance
    alignmentDistance: number = 50;      // Alignment perception distance
    cohesionDistance: number = 50;       // Cohesion perception distance

    // ========== Motion Constraints ==========
    maxSpeed: number = 4.0;              // Maximum speed
    maxForce: number = 0.1;              // Maximum steering force
    maxAcceleration: number = 0.5;       // Maximum acceleration

    // ========== Vision Parameters ==========
    visionAngle: number = 270;           // Vision angle (degrees)
    useVisionCone: boolean = false;      // Whether to enable vision cone restriction

    // ========== Boundary Behavior ==========
    boundaryType: 'wrap' | 'bounce' | 'soft' = 'soft';  // Boundary type
    boundaryMargin: number = 50;         // Boundary margin
    boundaryForce: number = 0.5;         // Boundary force

    // ========== Spatial Limits ==========
    bounds: {
        min: Vector3;
        max: Vector3;
    } = {
            min: new Vector3(-500, 0, -500),
            max: new Vector3(500, 500, 500)
        };

    // ========== Advanced Behaviors ==========
    avoidanceWeight: number = 2.0;       // Obstacle avoidance weight (reserved)
    avoidanceDistance: number = 100;     // Avoidance perception distance

    targetWeight: number = 0.5;          // Target point attraction weight
    targetPosition: Vector3 | null = null;  // Target position

    wanderWeight: number = 0.1;          // Random wander weight
    wanderRadius: number = 20;           // Wander radius
    wanderDistance: number = 50;         // Wander projection distance
    wanderJitter: number = 1;            // Wander jitter strength

    // ========== Hierarchical Behavior (Group Formation) ==========
    enableFlocking: boolean = true;      // Enable flocking behavior
    leaderFollowWeight: number = 0.0;    // Leader following weight
    leaderIds: Set<number> = new Set();  // Leader ID set
    // Group-aware behavior: when enabled, alignment and cohesion applies only within same group,
    // while inter-group separation uses a configurable distance/weight.
    groupAwareMode: boolean = false;
    interGroupSeparationDistance: number = 50;
    interGroupSeparationWeight: number = 2.0;

    // ========== Performance Optimization ==========
    spatialHashCellSize: number = 50;    // Spatial hash grid cell size
    maxNeighbors: number = 50;           // Maximum neighbor detection count

    // ========== Rendering Related ==========
    droneSize: number = 1.0;             // Drone size
    showVelocityVector: boolean = false; // Show velocity vectors
    showNeighborLines: boolean = false;  // Show neighbor lines
    // Global emissive color used by the boid material (hex number)
    emissiveColor: number = 0xffffff;
    // Global emissive intensity multiplier
    emissiveIntensity: number = 1.0;

    // ========== Debug Mode ==========
    debugMode: boolean = false;

    /**
     * Clone configuration
     */
    clone(): BoidConfig {
        const config = new BoidConfig();
        Object.assign(config, this);
        config.bounds = {
            min: this.bounds.min.clone(),
            max: this.bounds.max.clone()
        };
        config.targetPosition = this.targetPosition?.clone() || null;
        config.leaderIds = new Set(this.leaderIds);
        return config;
    }

    /**
     * Restore configuration from JSON
     */
    static fromJSON(json: any): BoidConfig {
        const config = new BoidConfig();
        Object.assign(config, json);
        return config;
    }
}

