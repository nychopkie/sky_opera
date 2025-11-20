import { Vector3 } from 'three';
import { Boid } from './Boid';
import { BoidConfig } from './BoidConfig';
import { SpatialHash } from './SpatialHash';

/**
 * Boid swarm management system
 */
export class BoidSystem {
    boids: Boid[] = [];
    config: BoidConfig;
    private spatialHash: SpatialHash;

    // Performance statistics
    stats = {
        updateTime: 0,
        neighborSearchTime: 0,
        forceCalculationTime: 0
    };

    constructor(config: BoidConfig) {
        this.config = config;
        this.spatialHash = new SpatialHash(config.spatialHashCellSize);
    }

    /**
     * Initialize Boid swarm
     */
    initializeBoids(count: number): void {
        this.boids = [];
        const { min, max } = this.config.bounds;

        for (let i = 0; i < count; i++) {
            const position = new Vector3(
                min.x + Math.random() * (max.x - min.x),
                min.y + Math.random() * (max.y - min.y) * 0.5 + (max.y - min.y) * 0.25, // Concentrate in upper middle
                min.z + Math.random() * (max.z - min.z)
            );

            const velocity = new Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
            ).normalize().multiplyScalar(this.config.maxSpeed * 0.5);

            this.boids.push(new Boid(i, position, velocity));
        }
    }

    /**
     * Add single Boid
     */
    addBoid(position?: Vector3, velocity?: Vector3): Boid {
        const boid = new Boid(this.boids.length, position, velocity);
        this.boids.push(boid);
        return boid;
    }

    /**
     * Remove Boid
     */
    removeBoid(id: number): void {
        const index = this.boids.findIndex(b => b.id === id);
        if (index !== -1) {
            this.boids.splice(index, 1);
        }
    }

    /**
     * Update all Boids
     */
    update(): void {
        const startTime = performance.now();

        // 1. Rebuild spatial hash
        this.spatialHash.clear();
        for (const boid of this.boids) {
            this.spatialHash.insert(boid);
        }

        // 2. Find neighbors
        const neighborStartTime = performance.now();
        const maxSearchRadius = Math.max(
            this.config.separationDistance,
            this.config.alignmentDistance,
            this.config.cohesionDistance
        );

        for (const boid of this.boids) {
            const nearby = this.spatialHash.findNearby(boid.position, maxSearchRadius);

            // Filter and limit neighbor count
            boid.neighbors = nearby
                .filter(other => other.id !== boid.id && boid.isInVision(other, this.config))
                .slice(0, this.config.maxNeighbors);
        }
        this.stats.neighborSearchTime = performance.now() - neighborStartTime;

        // 3. Calculate forces
        const forceStartTime = performance.now();
        for (const boid of this.boids) {
            boid.calculateForces(this.boids, this.config);
        }
        this.stats.forceCalculationTime = performance.now() - forceStartTime;

        // 4. Update positions and velocities
        for (const boid of this.boids) {
            boid.update(this.config);
        }

        this.stats.updateTime = performance.now() - startTime;
    }

    /**
     * Set target point
     */
    setTarget(position: Vector3 | null): void {
        this.config.targetPosition = position;
    }

    /**
     * Add leader
     */
    addLeader(boidId: number): void {
        this.config.leaderIds.add(boidId);
    }

    /**
     * Remove leader
     */
    removeLeader(boidId: number): void {
        this.config.leaderIds.delete(boidId);
    }

    /**
     * Randomly select leaders
     */
    randomizeLeaders(count: number): void {
        this.config.leaderIds.clear();

        const shuffled = [...this.boids].sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(count, shuffled.length); i++) {
            this.config.leaderIds.add(shuffled[i].id);
        }
    }

    /**
     * Reset all Boid positions
     */
    reset(): void {
        const count = this.boids.length;
        this.initializeBoids(count);
    }

    /**
     * Get system statistics
     */
    getStats() {
        const spatialStats = this.spatialHash.getStats();

        return {
            boidCount: this.boids.length,
            ...this.stats,
            ...spatialStats,
            avgNeighbors: this.boids.reduce((sum, b) => sum + b.neighbors.length, 0) / this.boids.length
        };
    }

    /**
     * Export configuration
     */
    exportConfig(): string {
        return JSON.stringify({
            ...this.config,
            bounds: {
                min: this.config.bounds.min.toArray(),
                max: this.config.bounds.max.toArray()
            },
            targetPosition: this.config.targetPosition?.toArray() || null
        }, null, 2);
    }

    /**
     * Import configuration
     */
    importConfig(json: string): void {
        try {
            const data = JSON.parse(json);
            Object.assign(this.config, data);

            if (data.bounds) {
                this.config.bounds.min.fromArray(data.bounds.min);
                this.config.bounds.max.fromArray(data.bounds.max);
            }

            if (data.targetPosition) {
                this.config.targetPosition = new Vector3().fromArray(data.targetPosition);
            }
        } catch (error) {
            console.error('Configuration import failed:', error);
        }
    }
}

