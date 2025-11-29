// const progress = this.sceneTime / this.config.scene2_duration;
//         this.initialBoids.forEach((boid, i) => {
//             // outline of shenzheng coordinates (simplified)
//             const angle = (i / this.initialBoids.length) * Math.PI * 2;
//             const radius = 200;
//             const targetX = radius * Math.cos(angle);
//             const targetY = 150 + Math.sin(angle * 3) * 50; // some vertical variation
//             const targetZ = radius * Math.sin(angle);
//             boid.storyTarget = new Vector3();
//             boid.storyTarget!.set(targetX, targetY, targetZ);
//             boid.isVisible = true;
//             boid.lightIntensity = 1.0; // fully lit
//         });

//         // background boids remain invisible
//         this.backgroundBoids.forEach((boid) => {
//             boid.isVisible = false;
//             boid.lightIntensity = 0.0;
//             boid.velocity.set(0, 0, 0);
//             boid.storyTarget = new Vector3();
//         });