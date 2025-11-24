import { Vector3, Color } from 'three';
import { BoidConfig } from './BoidConfig';

/**
 * Individual Boid entity (drone)
 */
export class Boid {
    id: number;
    position: Vector3;
    velocity: Vector3;
    acceleration: Vector3;

    // --- Story Mode Properties ---
    // When set, this Boid will ignore normal flocking and seek this target.
    public storyTarget: Vector3 | null = null;
    // Controls visibility for rendering.
    public isVisible: boolean = true;
    // Controls light intensity for rendering.
    public lightIntensity: number = 1.0;
    // Used in Scene 3 to store group color and ratio info
    public groupData: any = null;
    public color: Color = new Color(0xffffff); // Default color is white


    // Wander behavior state
    private wanderAngle: number = 0;

    // Cached neighbor list (performance optimization)
    neighbors: Boid[] = [];

    constructor(id: number, position?: Vector3, velocity?: Vector3) {
        this.id = id;
        this.position = position || new Vector3();
        this.velocity = velocity || new Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
        ).normalize();
        this.acceleration = new Vector3();
    }

    /**
     * Update Boid state
     */
    update(config: BoidConfig): void {
        // Apply acceleration
        this.velocity.add(this.acceleration);

        // Limit speed
        const speed = this.velocity.length();
        if (speed > config.maxSpeed) {
            this.velocity.divideScalar(speed).multiplyScalar(config.maxSpeed);
        }

        // Update position
        this.position.add(this.velocity);

        // Handle boundaries
        this.handleBoundaries(config);

        // Reset acceleration
        this.acceleration.set(0, 0, 0);
    }

    /**
     * Apply steering force
     */
    applyForce(force: Vector3, config: BoidConfig): void {
        // Limit maximum force
        if (force.length() > config.maxForce) {
            force.normalize().multiplyScalar(config.maxForce);
        }
        this.acceleration.add(force);
    }

    /**
     * Calculate all behavior forces
     */
    calculateForces(_allBoids: Boid[], config: BoidConfig): void {
        // --- Story Mode Override ---
        // If a story target is set, we override all other behaviors
        // and apply a strong force towards that target.
        if (this.storyTarget) {
            const storyForce = this.seek(this.storyTarget, config).multiplyScalar(config.targetWeight * 2); // Give it extra weight
            this.applyForce(storyForce, config);
            // Optionally, add a small amount of separation to prevent clumping at the target
            const separation = this.separate(config).multiplyScalar(config.separationWeight * 0.1);
            this.applyForce(separation, config);
            return;
        }

        if (!config.enableFlocking) return;

        // If group-aware mode is enabled, compute forces with group separation:
        // - Alignment & cohesion only from same-group neighbors
        // - Separation from same-group neighbors as usual, and an extra inter-group separation
        if (config.groupAwareMode && this.groupData) {
            const sep = new Vector3();
            const sepCount = { same: 0, other: 0 };

            const align = new Vector3();
            let alignCount = 0;

            const cohPos = new Vector3();
            let cohCount = 0;

            for (const other of this.neighbors) {
                const distance = this.position.distanceTo(other.position);
                if (distance <= 0) continue;

                const sameGroup = other.groupData && this.groupData && other.groupData === this.groupData;

                if (sameGroup) {
                    if (distance < config.separationDistance) {
                        const diff = new Vector3().subVectors(this.position, other.position).normalize().divideScalar(distance);
                        sep.add(diff);
                        sepCount.same++;
                    }

                    if (distance < config.alignmentDistance) {
                        align.add(other.velocity);
                        alignCount++;
                    }

                    if (distance < config.cohesionDistance) {
                        cohPos.add(other.position);
                        cohCount++;
                    }
                } else {
                    // Other-group separation if within interGroupSeparationDistance
                    if (distance < config.interGroupSeparationDistance) {
                        const diff = new Vector3().subVectors(this.position, other.position).normalize().divideScalar(distance);
                        sep.add(diff);
                        sepCount.other++;
                    }
                }
            }

            // Compose separation
            let separationForce = new Vector3();
            if (sepCount.same > 0) {
                separationForce.add(sep.clone().divideScalar(sepCount.same).normalize().multiplyScalar(config.maxSpeed).sub(this.velocity));
            }
            if (sepCount.other > 0) {
                const otherSep = sep.clone().divideScalar(sepCount.other).normalize().multiplyScalar(config.maxSpeed).sub(this.velocity);
                separationForce.add(otherSep.multiplyScalar(config.interGroupSeparationWeight));
            }

            // Alignment (same-group)
            let alignmentForce = new Vector3();
            if (alignCount > 0) {
                alignmentForce.copy(align.divideScalar(alignCount).normalize().multiplyScalar(config.maxSpeed).sub(this.velocity));
            }

            // Cohesion (same-group)
            let cohesionForce = new Vector3();
            if (cohCount > 0) {
                const center = cohPos.divideScalar(cohCount);
                cohesionForce = this.seek(center, config);
            }

            const boundary = this.boundaryForce(config).multiplyScalar(config.boundaryForce);

            this.applyForce(separationForce.multiplyScalar(config.separationWeight), config);
            this.applyForce(alignmentForce.multiplyScalar(config.alignmentWeight), config);
            this.applyForce(cohesionForce.multiplyScalar(config.cohesionWeight), config);
            this.applyForce(boundary, config);
        } else {
            // Default behavior
            const separation = this.separate(config).multiplyScalar(config.separationWeight);
            const alignment = this.align(config).multiplyScalar(config.alignmentWeight);
            const cohesion = this.cohere(config).multiplyScalar(config.cohesionWeight);
            const boundary = this.boundaryForce(config).multiplyScalar(config.boundaryForce);

            this.applyForce(separation, config);
            this.applyForce(alignment, config);
            this.applyForce(cohesion, config);
            this.applyForce(boundary, config);
        }

        // Optional behaviors
        if (config.wanderWeight > 0) {
            const wander = this.wander(config).multiplyScalar(config.wanderWeight);
            this.applyForce(wander, config);
        }

        if (config.targetPosition && config.targetWeight > 0) {
            const seek = this.seek(config.targetPosition, config).multiplyScalar(config.targetWeight);
            this.applyForce(seek, config);
        }
    }

    /**
     * Separation behavior - avoid crowding
     */
    private separate(config: BoidConfig): Vector3 {
        const steer = new Vector3();
        let count = 0;

        for (const other of this.neighbors) {
            const distance = this.position.distanceTo(other.position);

            if (distance > 0 && distance < config.separationDistance) {
                const diff = new Vector3().subVectors(this.position, other.position);
                diff.normalize();
                diff.divideScalar(distance); // Closer distance means stronger force
                steer.add(diff);
                count++;
            }
        }

        if (count > 0) {
            steer.divideScalar(count);
            steer.normalize().multiplyScalar(config.maxSpeed);
            steer.sub(this.velocity);
        }

        return steer;
    }

    /**
     * Alignment behavior - match neighbor directions
     */
    private align(config: BoidConfig): Vector3 {
        const avgVelocity = new Vector3();
        let count = 0;

        for (const other of this.neighbors) {
            const distance = this.position.distanceTo(other.position);

            if (distance > 0 && distance < config.alignmentDistance) {
                avgVelocity.add(other.velocity);
                count++;
            }
        }

        if (count > 0) {
            avgVelocity.divideScalar(count);
            avgVelocity.normalize().multiplyScalar(config.maxSpeed);
            return avgVelocity.sub(this.velocity);
        }

        return avgVelocity;
    }

    /**
     * Cohesion behavior - move toward neighbor center
     */
    private cohere(config: BoidConfig): Vector3 {
        const centerOfMass = new Vector3();
        let count = 0;

        for (const other of this.neighbors) {
            const distance = this.position.distanceTo(other.position);

            if (distance > 0 && distance < config.cohesionDistance) {
                centerOfMass.add(other.position);
                count++;
            }
        }

        if (count > 0) {
            centerOfMass.divideScalar(count);
            return this.seek(centerOfMass, config);
        }

        return centerOfMass;
    }

    /**
     * Seek target - basic steering behavior
     */
    private seek(target: Vector3, config: BoidConfig): Vector3 {
        const desired = new Vector3().subVectors(target, this.position);
        desired.normalize().multiplyScalar(config.maxSpeed);
        return desired.sub(this.velocity);
    }

    /**
     * Wander behavior - random exploration
     */
    private wander(config: BoidConfig): Vector3 {
        // Project a circle ahead and pick a random point on it
        const circleCenter = this.velocity.clone().normalize().multiplyScalar(config.wanderDistance);

        // Update wander angle
        this.wanderAngle += (Math.random() - 0.5) * config.wanderJitter;

        // Create displacement on XY plane
        const displacement = new Vector3(
            Math.cos(this.wanderAngle) * config.wanderRadius,
            Math.sin(this.wanderAngle) * config.wanderRadius,
            0
        );

        const target = this.position.clone().add(circleCenter).add(displacement);
        return this.seek(target, config);
    }

    /**
     * Boundary repulsion force
     */
    private boundaryForce(config: BoidConfig): Vector3 {
        const force = new Vector3();
        const { min, max } = config.bounds;
        const margin = config.boundaryMargin;

        // X-axis boundary
        if (this.position.x < min.x + margin) {
            force.x = config.maxSpeed;
        } else if (this.position.x > max.x - margin) {
            force.x = -config.maxSpeed;
        }

        // Y-axis boundary
        if (this.position.y < min.y + margin) {
            force.y = config.maxSpeed;
        } else if (this.position.y > max.y - margin) {
            force.y = -config.maxSpeed;
        }

        // Z-axis boundary
        if (this.position.z < min.z + margin) {
            force.z = config.maxSpeed;
        } else if (this.position.z > max.z - margin) {
            force.z = -config.maxSpeed;
        }

        return force;
    }

    /**
     * Boundary handling
     */
    private handleBoundaries(config: BoidConfig): void {
        const { min, max } = config.bounds;

        switch (config.boundaryType) {
            case 'wrap':
                // Wrap-around boundary
                if (this.position.x < min.x) this.position.x = max.x;
                if (this.position.x > max.x) this.position.x = min.x;
                if (this.position.y < min.y) this.position.y = max.y;
                if (this.position.y > max.y) this.position.y = min.y;
                if (this.position.z < min.z) this.position.z = max.z;
                if (this.position.z > max.z) this.position.z = min.z;
                break;

            case 'bounce':
                // Bounce boundary
                if (this.position.x < min.x || this.position.x > max.x) {
                    this.velocity.x *= -1;
                    this.position.x = Math.max(min.x, Math.min(max.x, this.position.x));
                }
                if (this.position.y < min.y || this.position.y > max.y) {
                    this.velocity.y *= -1;
                    this.position.y = Math.max(min.y, Math.min(max.y, this.position.y));
                }
                if (this.position.z < min.z || this.position.z > max.z) {
                    this.velocity.z *= -1;
                    this.position.z = Math.max(min.z, Math.min(max.z, this.position.z));
                }
                break;

            case 'soft':
                // Soft boundary (handled by boundaryForce)
                // Only apply hard limits to prevent out-of-bounds
                this.position.x = Math.max(min.x, Math.min(max.x, this.position.x));
                this.position.y = Math.max(min.y, Math.min(max.y, this.position.y));
                this.position.z = Math.max(min.z, Math.min(max.z, this.position.z));
                break;
        }
    }

    /**
     * Check if within field of view
     */
    isInVision(other: Boid, config: BoidConfig): boolean {
        if (!config.useVisionCone) return true;

        const toOther = new Vector3().subVectors(other.position, this.position);
        const angle = this.velocity.angleTo(toOther) * (180 / Math.PI);

        return angle < config.visionAngle / 2;
    }
}

