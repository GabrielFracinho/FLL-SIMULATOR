import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { SimConfig } from './sim-config';

export interface MissionModel {
  id: string;
  type: 'box' | 'cylinder';
  size: number[]; // box: [width, height, depth], cylinder: [radius, height]
  color: number;
  position: { x: number, y: number, z: number };
  rotation?: { x: number, y: number, z: number }; // Rotation in Degrees (Euler XYZ)
  isDynamic?: boolean; // If true, object can be pushed/moved
  
  // Physics Properties
  mass?: number;        // Mass in kg (only used if isDynamic=true)
  friction?: number;    // 0.0 (ice) to 1.0 (rubber). Default ~0.5
  restitution?: number; // Bounciness 0.0 to 1.0. Default ~0.1
}

export interface SeasonConfig {
  id: string;
  name: string;
  year: number;
  models: MissionModel[];
}

@Injectable({ providedIn: 'root' })
export class SeasonService {

  // Mock JSON Configuration. Coordinates are for a 1.22m (X) by 2.44m (Z) mat.
  private readonly DEMO_SEASON: SeasonConfig = {
    id: 'season_demo_2024',
    name: 'FLL Masterpiece Demo',
    year: 2024,
    models: [
      // 1. Static Red Platform (High Friction)
      {
        id: 'platform_red',
        type: 'box',
        size: [0.20, 0.05, 0.20],
        color: 0xef4444, 
        position: { x: 0.3, y: 0.025, z: 2.1 },
        friction: 0.8
      },
      // 2. Static Blue Pillar
      {
        id: 'pillar_blue',
        type: 'cylinder',
        size: [0.03, 0.15],
        color: 0x3b82f6, 
        position: { x: 0.8, y: 0.075, z: 1.2 }
      },
      // 3. Rotated Green Wall (45 degrees)
      {
        id: 'wall_green_angled',
        type: 'box',
        size: [0.02, 0.10, 0.40],
        color: 0x22c55e, 
        position: { x: 0.8, y: 0.05, z: 0.4 },
        rotation: { x: 0, y: 45, z: 0 }
      },
      // 4. Dynamic Orange Cube (Pushable, defined mass)
      {
        id: 'cube_dynamic',
        type: 'box',
        size: [0.08, 0.08, 0.08],
        color: 0xf59e0b, 
        position: { x: 1.0, y: 0.04, z: 1.0 },
        isDynamic: true,
        mass: 0.2, // 200g
        friction: 0.6
      },
       // 5. Dynamic Cylinder (Rolling)
       {
        id: 'cyl_dynamic',
        type: 'cylinder',
        size: [0.04, 0.12], // Radius, Height (Length)
        color: 0xa855f7, 
        position: { x: 0.4, y: 0.04, z: 1.8 },
        rotation: { x: 90, y: 0, z: 0 }, // Lying on side along Z axis
        isDynamic: true,
        mass: 0.1,
        friction: 0.3 // Slippery
      }
    ]
  };

  getActiveSeason(): SeasonConfig {
    return this.DEMO_SEASON;
  }
}
