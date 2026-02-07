// NeoChat AI - Three.js 3D Scene
// Neural Network Particle Background + Crystal Orb

class NeoScene {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.particles = null;
        this.orb = null;
        this.orbGlow = null;
        this.mouse = { x: 0, y: 0 };
        this.isThinking = false;
        this.clock = new THREE.Clock();
        
        this.init();
        this.createParticleNetwork();
        this.createCrystalOrb();
        this.animate();
        this.setupEventListeners();
    }
    
    init() {
        // Main scene
        this.scene = new THREE.Scene();
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 50;
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x010101, 1);
        
        document.getElementById('three-container').appendChild(this.renderer.domElement);
        
        // Orb scene
        this.orbScene = new THREE.Scene();
        this.orbCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        this.orbCamera.position.z = 3;
        
        this.orbRenderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.orbRenderer.setSize(160, 160);
        this.orbRenderer.setClearColor(0x000000, 0);
        
        document.getElementById('orb-container').appendChild(this.orbRenderer.domElement);
    }
    
    createParticleNetwork() {
        const particleCount = 300;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        const colorPalette = [
            new THREE.Color(0x8B5CF6), // Purple
            new THREE.Color(0x06B6D4), // Cyan
            new THREE.Color(0xEC4899), // Pink
            new THREE.Color(0x3B82F6)  // Blue
        ];
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Random positions in space
            positions[i3] = (Math.random() - 0.5) * 100;
            positions[i3 + 1] = (Math.random() - 0.5) * 100;
            positions[i3 + 2] = (Math.random() - 0.5) * 50 - 25;
            
            // Random color from palette
            const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
            
            // Random sizes
            sizes[i] = Math.random() * 2 + 0.5;
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Custom shader material for glowing particles
        const material = new THREE.PointsMaterial({
            size: 1.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.particlePositions = positions;
        this.originalPositions = positions.slice();
        this.scene.add(this.particles);
        
        // Create connection lines
        this.createConnectionLines();
    }
    
    createConnectionLines() {
        const linesMaterial = new THREE.LineBasicMaterial({
            color: 0x8B5CF6,
            transparent: true,
            opacity: 0.1,
            blending: THREE.AdditiveBlending
        });
        
        const linesGeometry = new THREE.BufferGeometry();
        const linePositions = [];
        
        // Connect nearby particles
        const positions = this.particles.geometry.attributes.position.array;
        const connectionDistance = 15;
        
        for (let i = 0; i < positions.length; i += 3) {
            for (let j = i + 3; j < positions.length; j += 3) {
                const dx = positions[i] - positions[j];
                const dy = positions[i + 1] - positions[j + 1];
                const dz = positions[i + 2] - positions[j + 2];
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (dist < connectionDistance && Math.random() > 0.95) {
                    linePositions.push(
                        positions[i], positions[i + 1], positions[i + 2],
                        positions[j], positions[j + 1], positions[j + 2]
                    );
                }
            }
        }
        
        linesGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(linePositions, 3)
        );
        
        this.connectionLines = new THREE.LineSegments(linesGeometry, linesMaterial);
        this.scene.add(this.connectionLines);
    }
    
    createCrystalOrb() {
        // Crystal orb geometry
        const orbGeometry = new THREE.IcosahedronGeometry(1, 2);
        
        // Custom shader for crystal effect
        const orbMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x8B5CF6,
            metalness: 0.1,
            roughness: 0.2,
            transmission: 0.9,
            thickness: 1.5,
            envMapIntensity: 1,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        
        this.orb = new THREE.Mesh(orbGeometry, orbMaterial);
        
        // Inner glow
        const glowGeometry = new THREE.IcosahedronGeometry(0.7, 2);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x06B6D4,
            transparent: true,
            opacity: 0.5
        });
        this.orbGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.orb.add(this.orbGlow);
        
        // Outer glow effect
        const outerGlowGeometry = new THREE.IcosahedronGeometry(1.2, 2);
        const outerGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0x8B5CF6,
            transparent: true,
            opacity: 0.1,
            side: THREE.BackSide
        });
        this.orbOuterGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
        this.orb.add(this.orbOuterGlow);
        
        // Lighting for orb
        const pointLight = new THREE.PointLight(0x8B5CF6, 1, 10);
        pointLight.position.set(2, 2, 2);
        this.orbScene.add(pointLight);
        
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.orbScene.add(ambientLight);
        
        this.orbScene.add(this.orb);
    }
    
    setThinking(isThinking) {
        this.isThinking = isThinking;
        
        // Update orb visuals when thinking
        if (this.orb) {
            if (isThinking) {
                this.orb.material.color.setHex(0x06B6D4);
                this.orbGlow.material.color.setHex(0xEC4899);
            } else {
                this.orb.material.color.setHex(0x8B5CF6);
                this.orbGlow.material.color.setHex(0x06B6D4);
            }
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const time = this.clock.getElapsedTime();
        
        // Animate particles based on mouse
        if (this.particles) {
            const positions = this.particles.geometry.attributes.position.array;
            
            for (let i = 0; i < positions.length; i += 3) {
                // Gentle floating motion
                positions[i + 1] = this.originalPositions[i + 1] + Math.sin(time * 0.5 + i) * 0.5;
                
                // React to mouse
                const dx = (this.mouse.x * 50) - positions[i];
                const dy = (this.mouse.y * 50) - positions[i + 1];
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 30) {
                    const force = (30 - dist) / 30 * 0.02;
                    positions[i] += dx * force;
                    positions[i + 1] += dy * force;
                }
            }
            
            this.particles.geometry.attributes.position.needsUpdate = true;
            this.particles.rotation.y = time * 0.02;
        }
        
        // Animate connection lines
        if (this.connectionLines) {
            this.connectionLines.rotation.y = time * 0.02;
            this.connectionLines.material.opacity = 0.05 + Math.sin(time) * 0.03;
        }
        
        // Animate orb
        if (this.orb) {
            this.orb.rotation.x = time * 0.3;
            this.orb.rotation.y = time * 0.5;
            
            if (this.isThinking) {
                // Pulse faster when thinking
                const pulse = Math.sin(time * 5) * 0.1 + 1;
                this.orb.scale.setScalar(pulse);
                this.orbGlow.material.opacity = 0.5 + Math.sin(time * 8) * 0.3;
                this.orbOuterGlow.material.opacity = 0.2 + Math.sin(time * 5) * 0.1;
            } else {
                // Gentle pulse
                const pulse = Math.sin(time * 2) * 0.05 + 1;
                this.orb.scale.setScalar(pulse);
                this.orbGlow.material.opacity = 0.5;
                this.orbOuterGlow.material.opacity = 0.1;
            }
        }
        
        this.renderer.render(this.scene, this.camera);
        this.orbRenderer.render(this.orbScene, this.orbCamera);
    }
    
    setupEventListeners() {
        // Mouse movement for particle reaction
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
}

// Initialize the scene
const neoScene = new NeoScene();

// Export for global access
window.neoScene = neoScene;
