import { Vector3 } from 'three';
import { Boid } from './Boid';

/**
 * Spatial hash grid - optimize neighbor search performance
 * Divide 3D space into grids, only check Boids in adjacent grids
 */
export class SpatialHash {
    private cellSize: number;
    private grid: Map<string, Boid[]>;

    constructor(cellSize: number) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    /**
     * Clear grid
     */
    clear(): void {
        this.grid.clear();
    }

    /**
     * Insert Boid into grid
     */
    insert(boid: Boid): void {
        const key = this.getKey(boid.position);

        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }

        this.grid.get(key)!.push(boid);
    }

    /**
     * Find nearby Boids
     */
    findNearby(position: Vector3, radius: number): Boid[] {
        const nearby: Boid[] = [];
        const cellRadius = Math.ceil(radius / this.cellSize);

        const centerCell = this.positionToCell(position);

        // Check adjacent grids
        for (let x = -cellRadius; x <= cellRadius; x++) {
            for (let y = -cellRadius; y <= cellRadius; y++) {
                for (let z = -cellRadius; z <= cellRadius; z++) {
                    const key = this.cellToKey(
                        centerCell.x + x,
                        centerCell.y + y,
                        centerCell.z + z
                    );

                    const cell = this.grid.get(key);
                    if (cell) {
                        nearby.push(...cell);
                    }
                }
            }
        }

        return nearby;
    }

    /**
     * Position to grid coordinates
     */
    private positionToCell(position: Vector3): { x: number; y: number; z: number } {
        return {
            x: Math.floor(position.x / this.cellSize),
            y: Math.floor(position.y / this.cellSize),
            z: Math.floor(position.z / this.cellSize)
        };
    }

    /**
     * Position to hash key
     */
    private getKey(position: Vector3): string {
        const cell = this.positionToCell(position);
        return this.cellToKey(cell.x, cell.y, cell.z);
    }

    /**
     * Grid coordinates to hash key
     */
    private cellToKey(x: number, y: number, z: number): string {
        return `${x},${y},${z}`;
    }

    /**
     * Get grid statistics
     */
    getStats(): { cellCount: number; avgBoidsPerCell: number; maxBoidsInCell: number } {
        let maxBoids = 0;
        let totalBoids = 0;

        for (const cell of this.grid.values()) {
            maxBoids = Math.max(maxBoids, cell.length);
            totalBoids += cell.length;
        }

        return {
            cellCount: this.grid.size,
            avgBoidsPerCell: this.grid.size > 0 ? totalBoids / this.grid.size : 0,
            maxBoidsInCell: maxBoids
        };
    }
}

