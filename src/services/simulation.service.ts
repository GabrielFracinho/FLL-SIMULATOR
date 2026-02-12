import { Injectable, signal, ElementRef, inject } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SimConfig } from './sim-config';
import { SensorState } from './input.service';
import { SeasonService, MissionModel } from './season.service';
import { InputService } from './input.service';

@Injectable({ providedIn: 'root' })
export class SimulationService {
  private canvas!: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  
  // Physics (Rapier)
  private RAPIER: any;
  private world: any; 
  private robotBody: any; 
  
  // Visuals
  private robotMesh!: THREE.Group;
  private wheelMeshes: THREE.Object3D[] = []; // [Left, Right]
  
  // Mission Objects Management
  private missionMeshes: THREE.Mesh[] = [];
  private missionBodies: any[] = [];
  private dynamicObjects: { mesh: THREE.Mesh, body: any }[] = [];
  
  // Simulation State
  private clock = new THREE.Clock();
  private animationId: number = 0;
  
  // Internal Encoder State (Degrees)
  private encoderL = 0;
  private encoderR = 0;
  
  // Signals for UI
  readonly sensorData = signal<SensorState>({ distance: 0, colorReflected: 0, colorID: 0, gyro: 0, leftEncoder: 0, rightEncoder: 0 });
  readonly robotPosition = signal({ x: 0, z: 0, r: 0 });
  
  // Public motor state for telemetry
  readonly motorLSpeed = signal(0);
  readonly motorRSpeed = signal(0);
  
  cameraMode: 'ORBIT' | 'FOLLOW' | 'FPV' | 'TOP' = 'ORBIT';

  private seasonService = inject(SeasonService);
  private inputService = inject(InputService);

  constructor() {}

  async init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initGraphics();
    await this.initPhysics();
    
    this.createFllTable();
    this.buildRobot();
    this.loadSeason();
    
    this.startAnimationLoop();
  }

  private loadSeason() {
      this.clearSeasonObjects();
      const season = this.seasonService.getActiveSeason();
      season.models.forEach(model => this.placeMissionModel(model));
  }

  private clearSeasonObjects() {
      this.missionMeshes.forEach(mesh => {
          this.scene.remove(mesh);
          if (mesh.geometry) mesh.geometry.dispose();
      });
      this.missionMeshes = [];

      if (this.world) {
          this.missionBodies.forEach(body => {
              this.world.removeRigidBody(body);
          });
      }
      this.missionBodies = [];
      this.dynamicObjects = [];
  }

  private initGraphics() {
    this.renderer = new THREE.WebGLRenderer({ 
        canvas: this.canvas, 
        antialias: true, 
        alpha: false 
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight - 56);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; 

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SimConfig.colors.background); 
    this.scene.fog = new THREE.Fog(SimConfig.colors.background, 10, 30);

    const aspectRatio = window.innerWidth / (window.innerHeight - 56);
    this.camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.01, 1000);
    this.camera.position.set(2, 2, 2); 
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 0.3;
    this.controls.maxDistance = 6;
    this.controls.zoomSpeed = 0.5;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.target.set(SimConfig.fllTable.matWidth / 2, 0, SimConfig.fllTable.matLength / 2);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 7.5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);
  }

  private async initPhysics() {
    const RAPIER_MOD = await import('@dimforge/rapier3d-compat');
    await RAPIER_MOD.init();
    this.RAPIER = RAPIER_MOD;
    this.world = new this.RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
  }

  private createFllTable() {
    const { matWidth, matLength, tableColor, borderHeight, borderThickness, borderColor } = SimConfig.fllTable;

    const tableGroup = new THREE.Group();
    const tableBody = this.world.createRigidBody(this.RAPIER.RigidBodyDesc.fixed());

    // 1. Create Mat
    const matGeo = new THREE.PlaneGeometry(matWidth, matLength);
    const textureLoader = new THREE.TextureLoader();
    const matTexture = textureLoader.load('assets/fll-mat.png', (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        
        // Use ClampToEdgeWrapping to prevent texture repeating at the borders.
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        // Ensure the texture is applied 1:1 without any repeating or offsetting.
        texture.repeat.set(1, 1);
        texture.offset.set(0, 0);
    });

    const matMaterial = new THREE.MeshStandardMaterial({ 
        map: matTexture, 
        color: 0xffffff, 
        roughness: 0.8, 
        metalness: 0.1 
    });
    const matMesh = new THREE.Mesh(matGeo, matMaterial);
    matMesh.rotation.x = -Math.PI / 2;
    matMesh.position.set(matWidth / 2, 0, matLength / 2);
    matMesh.receiveShadow = true;
    tableGroup.add(matMesh);

    // Physics collider for the mat/table surface
    const floorColliderDesc = this.RAPIER.ColliderDesc.cuboid(matWidth / 2, 0.01, matLength / 2)
        .setTranslation(matWidth / 2, -0.01, matLength / 2);
    this.world.createCollider(floorColliderDesc, tableBody);

    // 2. Create Walls
    const wallMaterial = new THREE.MeshStandardMaterial({ color: borderColor, roughness: 0.7 });
    const wallPositions: [number, number, number, number, number, number][] = [
      // x, y, z, width, height, depth
      [matWidth / 2, borderHeight / 2, -borderThickness / 2, matWidth + borderThickness * 2, borderHeight, borderThickness], // Bottom wall (-Z)
      [matWidth / 2, borderHeight / 2, matLength + borderThickness / 2, matWidth + borderThickness * 2, borderHeight, borderThickness], // Top wall (+Z)
      [-borderThickness / 2, borderHeight / 2, matLength / 2, borderThickness, borderHeight, matLength], // Left wall (-X)
      [matWidth + borderThickness / 2, borderHeight / 2, matLength / 2, borderThickness, borderHeight, matLength], // Right wall (+X)
    ];

    wallPositions.forEach(([px, py, pz, sx, sy, sz]) => {
        const wallGeo = new THREE.BoxGeometry(sx, sy, sz);
        const wallMesh = new THREE.Mesh(wallGeo, wallMaterial);
        wallMesh.position.set(px, py, pz);
        wallMesh.castShadow = true;
        tableGroup.add(wallMesh);

        const wallColliderDesc = this.RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2)
            .setTranslation(px, py, pz);
        this.world.createCollider(wallColliderDesc, tableBody);
    });

    this.scene.add(tableGroup);
}


  private buildRobot() {
    this.robotMesh = this.createRobotVisuals();
    this.scene.add(this.robotMesh);
    this.robotBody = this.createRobotPhysics();
    this.resetRobot();
  }

  private createRobotVisuals(): THREE.Group {
    const group = new THREE.Group();
    
    const matWhite = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.2, metalness: 0.05 });
    const matAzure = new THREE.MeshStandardMaterial({ color: 0x0085db, roughness: 0.5 });
    const matGrey = new THREE.MeshStandardMaterial({ color: 0xa0a0a0, roughness: 0.5 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
    const matRubber = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    
    const beamGeo = new THREE.BoxGeometry(0.12, 0.008, 0.008);
    const beam = new THREE.Mesh(beamGeo, matGrey);
    beam.position.set(0, 0.03, 0); 
    group.add(beam);
    
    const crossBeamGeo = new THREE.BoxGeometry(0.008, 0.008, 0.12);
    const crossBeamL = new THREE.Mesh(crossBeamGeo, matGrey);
    crossBeamL.position.set(-0.04, 0.03, 0);
    group.add(crossBeamL);

    const crossBeamR = new THREE.Mesh(crossBeamGeo, matGrey);
    crossBeamR.position.set(0.04, 0.03, 0);
    group.add(crossBeamR);

    const wheelY = 0; 
    
    const leftWheelGroup = this.createSpikeWheel(matRubber, matGrey);
    leftWheelGroup.position.set(-0.065, wheelY, 0);
    this.wheelMeshes[0] = leftWheelGroup;
    
    const rightWheelGroup = leftWheelGroup.clone();
    rightWheelGroup.position.set(0.065, wheelY, 0);
    rightWheelGroup.rotation.z = Math.PI; 
    rightWheelGroup.rotation.x = Math.PI; 
    this.wheelMeshes[1] = rightWheelGroup;

    group.add(leftWheelGroup, rightWheelGroup);

    const leftMotor = this.createSpikeMotor(matAzure, matWhite, matDark);
    leftMotor.position.set(-0.025, 0.035, 0);
    leftMotor.rotation.y = -Math.PI / 2;
    group.add(leftMotor);

    const rightMotor = leftMotor.clone();
    rightMotor.position.set(0.025, 0.035, 0);
    rightMotor.rotation.y = Math.PI / 2;
    rightMotor.scale.z = -1;
    group.add(rightMotor);

    const hub = this.createSpikeHub(matWhite, matDark);
    hub.position.set(0, 0.075, 0.02);
    hub.castShadow = true;
    group.add(hub);

    const ultrasonic = this.createUltrasonicSensor(matAzure, matDark, matWhite);
    ultrasonic.position.set(0, 0.045, -0.09);
    group.add(ultrasonic);

    const colorSensor = this.createColorSensor(matAzure, matDark, matWhite);
    colorSensor.position.set(0, 0.02, 0.06); 
    colorSensor.rotation.y = Math.PI;
    group.add(colorSensor);

    const casterBall = new THREE.Mesh(new THREE.SphereGeometry(0.015), matDark);
    casterBall.position.set(0, -0.013, 0.09);
    
    const casterHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.01), matWhite);
    casterHousing.position.set(0, 0, 0.09);
    group.add(casterBall, casterHousing);

    return group;
  }

  private createSpikeWheel(matTire: THREE.Material, matRim: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    const radius = SimConfig.robot.wheelRadius;
    const width = SimConfig.robot.wheelWidth;

    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 32);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, matTire);
    tire.castShadow = true;
    group.add(tire);
    
    const numKnobs = 16;
    const knobW = 0.004;
    const knobH = 0.002;
    const knobGeo = new THREE.BoxGeometry(knobW, width - 0.002, knobH);
    
    for(let i=0; i<numKnobs; i++) {
        const knob = new THREE.Mesh(knobGeo, matTire);
        const angle = (i / numKnobs) * Math.PI * 2;
        const y = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        knob.position.set(0, y, z);
        knob.rotation.x = -angle;
        group.add(knob);
    }

    const rimRadius = radius * 0.6;
    const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, width + 0.001, 16);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, matRim);
    group.add(rim);

    const axleGeo = new THREE.CylinderGeometry(0.004, 0.004, width + 0.004, 8);
    axleGeo.rotateZ(Math.PI / 2);
    const axle = new THREE.Mesh(axleGeo, new THREE.MeshStandardMaterial({color: 0x000000}));
    group.add(axle);

    return group;
  }

  private createSpikeMotor(matBlue: THREE.Material, matWhite: THREE.Material, matGrey: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(0.05, 0.03, 0.03);
    const body = new THREE.Mesh(bodyGeo, matWhite);
    group.add(body);

    const headGroup = new THREE.Group();
    headGroup.position.set(0.025, 0, 0);
    const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.03), matBlue);
    headGroup.add(headBox);
    const headCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 16), matBlue);
    headCyl.rotation.x = Math.PI/2;
    headGroup.add(headCyl);
    group.add(headGroup);

    const diskGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.004, 16);
    diskGeo.rotateX(Math.PI / 2); 
    const disk = new THREE.Mesh(diskGeo, matGrey);
    disk.position.set(0.025, 0, 0.017);
    const holeGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.005, 8);
    holeGeo.rotateX(Math.PI/2);
    const hole1 = new THREE.Mesh(holeGeo, new THREE.MeshStandardMaterial({color: 0x000000}));
    hole1.position.set(0.006, 0, 0);
    disk.add(hole1);
    const hole2 = hole1.clone();
    hole2.position.set(-0.006, 0, 0);
    disk.add(hole2);
    group.add(disk);

    return group;
  }

  private createSpikeHub(matWhite: THREE.Material, matDark: THREE.Material): THREE.Group {
      const group = new THREE.Group();
      const w = 0.09, h = 0.04, d = 0.13;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matWhite);
      group.add(body);
      
      const tex = this.createHubTexture();
      const faceMat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0.1 });
      const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, d * 0.9), faceMat);
      facePlane.rotation.x = -Math.PI / 2;
      facePlane.position.set(0, h/2 + 0.001, 0);
      group.add(facePlane);

      const btnGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.002, 24);
      const btn = new THREE.Mesh(btnGeo, matWhite);
      btn.position.set(0, h/2 + 0.002, -0.04);
      group.add(btn);
      
      const ringGeo = new THREE.RingGeometry(0.009, 0.010, 24);
      ringGeo.rotateX(-Math.PI/2);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      ring.position.set(0, h/2 + 0.002, -0.04);
      group.add(ring);

      return group;
  }

  private createUltrasonicSensor(matBlue: THREE.Material, matDark: THREE.Material, matWhite: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.02), matBlue);
    group.add(housing);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.02), matWhite);
    back.position.set(0, 0, 0.02);
    group.add(back);

    const eyeGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.005, 16);
    eyeGeo.rotateX(Math.PI / 2);
    const eyeL = new THREE.Mesh(eyeGeo, matDark);
    eyeL.position.set(-0.025, 0, -0.01);
    const rimGeo = new THREE.TorusGeometry(0.012, 0.001, 8, 16);
    const rimL = new THREE.Mesh(rimGeo, matBlue);
    rimL.position.set(0, 0.002, 0); 
    rimL.rotateX(Math.PI/2); 
    eyeL.add(rimL);
    const eyeR = eyeL.clone();
    eyeR.position.set(0.025, 0, -0.01);
    group.add(eyeL, eyeR);

    return group;
  }

  private createColorSensor(matBlue: THREE.Material, matDark: THREE.Material, matWhite: THREE.Material): THREE.Group {
      const group = new THREE.Group();
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), matBlue);
      group.add(housing);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), matWhite);
      back.position.set(0, 0, 0.025);
      group.add(back);
      const faceGeo = new THREE.BoxGeometry(0.028, 0.028, 0.005);
      const face = new THREE.Mesh(faceGeo, matDark);
      face.position.set(0, 0, -0.015);
      group.add(face);
      const lensGeo = new THREE.CircleGeometry(0.004, 16);
      const lens1 = new THREE.Mesh(lensGeo, new THREE.MeshBasicMaterial({color: 0x111111}));
      lens1.position.set(-0.007, 0, -0.003);
      face.add(lens1);
      const lens2 = new THREE.Mesh(lensGeo, new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.3}));
      lens2.position.set(0.007, 0, -0.003);
      face.add(lens2);
      return group;
  }

  private createRobotPhysics(): any {
      const startY = SimConfig.robot.wheelRadius; 
      const rigidBodyDesc = this.RAPIER.RigidBodyDesc.dynamic().setLinearDamping(2.0).setAngularDamping(5.0);
      const body = this.world.createRigidBody(rigidBodyDesc);
      
      const chassisCollider = this.RAPIER.ColliderDesc.cuboid(0.07, 0.04, 0.08).setTranslation(0, 0.04, 0.02).setDensity(1.5);
      this.world.createCollider(chassisCollider, body);
  
      const wheelColliderL = this.RAPIER.ColliderDesc.ball(SimConfig.robot.wheelRadius).setTranslation(-0.07, 0, 0).setFriction(2.5);
      this.world.createCollider(wheelColliderL, body);
  
      const wheelColliderR = this.RAPIER.ColliderDesc.ball(SimConfig.robot.wheelRadius).setTranslation(0.07, 0, 0).setFriction(2.5);
      this.world.createCollider(wheelColliderR, body);
      
      const casterCollider = this.RAPIER.ColliderDesc.ball(0.015).setTranslation(0, -0.013, 0.09).setFriction(0.0);
      this.world.createCollider(casterCollider, body);
      return body;
  }

  private createHubTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512; 
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#f1f5f9'; 
    ctx.fillRect(0,0,512,512);
    
    ctx.fillStyle = '#e2e8f0';
    const matrixW = 300; const matrixH = 300;
    const offsetX = (512 - matrixW) / 2; const offsetY = 140; 
    this.roundRect(ctx, offsetX, offsetY, matrixW, matrixH, 20);
    ctx.fill();
    
    const padding = 40; 
    const spacing = (matrixW - (padding*2)) / 4;
    
    for(let x = 0; x < 5; x++) {
        for(let y = 0; y < 5; y++) {
            const cx = offsetX + padding + x * spacing;
            const cy = offsetY + padding + y * spacing;
            
            ctx.beginPath(); 
            ctx.arc(cx, cy, 18, 0, Math.PI * 2); 
            
            const isEye = (y === 1 && (x === 1 || x === 3));
            const isMouth = (y === 3 && (x > 0 && x < 4));
            
            if (isEye || isMouth) {
                ctx.fillStyle = '#fbbf24'; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 15;
            } else {
                ctx.fillStyle = '#cbd5e1'; ctx.shadowBlur = 0;
            }
            ctx.fill();
        }
    }
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0f172a'; 
    ctx.font = 'bold 32px Arial'; ctx.textAlign = 'center'; ctx.fillText("SPIKE", 256, 80);
    ctx.fillStyle = '#3b82f6';
    ctx.font = '30px FontAwesome'; ctx.fillText('\uf294', 60, 60);
    return new THREE.CanvasTexture(canvas);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  private placeMissionModel(data: MissionModel) {
      let geometry: THREE.BufferGeometry; let colliderDesc: any;
      const [dim1, dim2, dim3] = data.size;
      if(data.type === 'box') {
          geometry = new THREE.BoxGeometry(dim1, dim2, dim3 || dim1);
          colliderDesc = this.RAPIER.ColliderDesc.cuboid(dim1 / 2, dim2 / 2, (dim3 || dim1) / 2);
      } else {
          geometry = new THREE.CylinderGeometry(dim1, dim1, dim2, 24);
          colliderDesc = this.RAPIER.ColliderDesc.cylinder(dim2 / 2, dim1);
      }
      const material = new THREE.MeshStandardMaterial({ color: data.color });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(data.position.x, data.position.y, data.position.z);
      if (data.rotation) mesh.rotation.set(THREE.MathUtils.degToRad(data.rotation.x), THREE.MathUtils.degToRad(data.rotation.y), THREE.MathUtils.degToRad(data.rotation.z));
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.scene.add(mesh); this.missionMeshes.push(mesh); 
      let rigidBodyDesc;
      if (data.isDynamic) {
         rigidBodyDesc = this.RAPIER.RigidBodyDesc.dynamic().setTranslation(data.position.x, data.position.y, data.position.z);
         if (data.mass) {
            const volume = this.calculateVolume(data.type, data.size);
            colliderDesc.setDensity(volume > 0 ? data.mass / volume : 0.5);
         } else { colliderDesc.setDensity(0.5); }
      } else {
         rigidBodyDesc = this.RAPIER.RigidBodyDesc.fixed().setTranslation(data.position.x, data.position.y, data.position.z);
      }
      if (data.friction !== undefined) colliderDesc.setFriction(data.friction);
      if (data.restitution !== undefined) colliderDesc.setRestitution(data.restitution);
      if (data.rotation) {
          const q = new THREE.Quaternion().setFromEuler(mesh.rotation);
          rigidBodyDesc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      }
      const body = this.world.createRigidBody(rigidBodyDesc);
      this.world.createCollider(colliderDesc, body);
      this.missionBodies.push(body);
      if (data.isDynamic) this.dynamicObjects.push({ mesh, body });
  }

  private calculateVolume(type: 'box' | 'cylinder', size: number[]): number {
    if (type === 'box') return size[0] * size[1] * (size[2] || size[0]);
    else return Math.PI * (size[0] * size[0]) * size[1];
  }

  private startAnimationLoop = () => {
    this.animationId = requestAnimationFrame(this.startAnimationLoop);
    const dt = this.clock.getDelta();

    if(this.world) {
        this.world.step();
        this.syncPhysicsToVisuals(dt);
    }
    
    this.updateCamera();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private syncPhysicsToVisuals(dt: number) {
      if(!this.robotBody) return;
      this.updateRobotControl(dt);

      const translation = this.robotBody.translation(); 
      const rotation = this.robotBody.rotation();
      this.robotMesh.position.set(translation.x, translation.y, translation.z);
      this.robotMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      
      const euler = new THREE.Euler().setFromQuaternion(this.robotMesh.quaternion);
      this.robotPosition.set({ x: translation.x, z: translation.z, r: -euler.y * (180 / Math.PI) });
      
      this.dynamicObjects.forEach(obj => {
          const t = obj.body.translation(); const r = obj.body.rotation();
          obj.mesh.position.set(t.x, t.y, t.z);
          obj.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      });
  }

  private updateRobotControl(dt: number) {
      let targetL = 0; let targetR = 0;
      const baseSpeed = 75;

      if (this.inputService.forward()) { targetL = baseSpeed; targetR = baseSpeed; } 
      else if (this.inputService.backward()) { targetL = -baseSpeed; targetR = -baseSpeed; }

      if (this.inputService.left()) { targetL -= baseSpeed; targetR += baseSpeed; } 
      else if (this.inputService.right()) { targetL += baseSpeed; targetR -= baseSpeed; }
      
      targetL = Math.max(-100, Math.min(100, targetL));
      targetR = Math.max(-100, Math.min(100, targetR));

      this.motorLSpeed.set(targetL);
      this.motorRSpeed.set(targetR);
      
      const maxSpeed = SimConfig.robot.maxSpeed;
      const speedL = (targetL / 100) * maxSpeed;
      const speedR = (targetR / 100) * maxSpeed;

      const circum = 2 * Math.PI * SimConfig.robot.wheelRadius;
      const rotL = ((speedL * dt) / circum) * 360;
      const rotR = ((speedR * dt) / circum) * 360;
      this.encoderL += rotL; this.encoderR += rotR;
      
      if (this.wheelMeshes.length === 2) {
          this.wheelMeshes[0].rotateX(-THREE.MathUtils.degToRad(rotL)); 
          this.wheelMeshes[1].rotateX(-THREE.MathUtils.degToRad(rotR));
      }

      const linearVelocity = (speedL + speedR) / 2;
      const angularVelocity = (speedR - speedL) / SimConfig.robot.wheelBase;

      const q = this.robotBody.rotation();
      const currentQuaternion = new THREE.Quaternion(q.x, q.y, q.z, q.w);
      const forwardVector = new THREE.Vector3(0, 0, 1).applyQuaternion(currentQuaternion);
      
      const velocityX = forwardVector.x * linearVelocity;
      const velocityZ = forwardVector.z * linearVelocity;

      this.robotBody.wakeUp();
      this.robotBody.setLinvel({ x: velocityX, y: this.robotBody.linvel().y, z: velocityZ }, true);
      this.robotBody.setAngvel({ x: 0, y: angularVelocity, z: 0 }, true);

      this.performSensorRaycasts(forwardVector, currentQuaternion);
  }

  private performSensorRaycasts(forward: THREE.Vector3, quaternion: THREE.Quaternion) {
      const position = this.robotBody.translation();
      
      const rayOrigin = { x: position.x + forward.x * 0.1, y: position.y + 0.05, z: position.z + forward.z * 0.1 };
      const rayDirection = { x: forward.x, y: 0, z: forward.z };
      
      const ray = new this.RAPIER.Ray(rayOrigin, rayDirection);
      const hit = this.world.castRay(ray, 10.0, true);
      const distanceCm = hit ? hit.toi * 100 : 255;

      let reflectedLight = 0; let colorID = 0;
      if (position.y < 0.2) { reflectedLight = 10; colorID = 0; }

      this.sensorData.set({ distance: distanceCm, colorReflected: reflectedLight, colorID: colorID, gyro: 0, leftEncoder: this.encoderL, rightEncoder: this.encoderR });
  }

  private updateCamera() {
      if(!this.robotMesh) return;
      const pos = this.robotMesh.position;
      const quat = this.robotMesh.quaternion;

      switch(this.cameraMode) {
          case 'FOLLOW':
              const offset = new THREE.Vector3(0, 0.4, -0.5).applyQuaternion(quat); 
              const targetPos = pos.clone().add(offset);
              this.camera.position.lerp(targetPos, 0.1);
              this.controls.target.lerp(pos, 0.1);
              break;
          case 'TOP':
              this.camera.position.lerp(new THREE.Vector3(pos.x, 3.0, pos.z), 0.1);
              this.controls.target.copy(pos);
              break;
          case 'FPV':
              const fpvOffset = new THREE.Vector3(0, 0.1, 0.15).applyQuaternion(quat);
              this.camera.position.copy(pos.clone().add(fpvOffset));
              const lookDir = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
              const lookTarget = this.camera.position.clone().add(lookDir);
              this.camera.lookAt(lookTarget);
              this.controls.target.copy(lookTarget);
              break;
      }
  }
  
  stopRobot() {
    this.motorLSpeed.set(0); this.motorRSpeed.set(0);
    if(this.robotBody) {
      this.robotBody.setLinvel({ x: 0, y: 0, z: 0}, true);
      this.robotBody.setAngvel({ x: 0, y: 0, z: 0}, true);
    }
  }

  setCameraMode(mode: 'ORBIT' | 'FOLLOW' | 'FPV' | 'TOP') {
      this.cameraMode = mode;
      this.controls.enabled = (mode === 'ORBIT');
      if (mode === 'ORBIT') {
        this.controls.target.copy(this.robotMesh.position);
      }
  }

  resetRobot() {
      if(this.robotBody) {
          this.robotBody.setTranslation({ x: 0.3, y: 0.05, z: 0.3 }, true);
          this.robotBody.setRotation({ x: 0, y: 0, z: 0, w: 1}, true);
          this.robotBody.setLinvel({ x: 0, y: 0, z: 0}, true);
          this.robotBody.setAngvel({ x: 0, y: 0, z: 0}, true);
      }
      this.encoderL = 0; this.encoderR = 0;
      this.motorLSpeed.set(0); this.motorRSpeed.set(0);
      this.loadSeason();
  }

  resize(width: number, height: number) {
    if(this.camera && this.renderer) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
  }
}
