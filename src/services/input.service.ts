import { Injectable, signal } from '@angular/core';

// Re-exporting SensorState here to keep SimulationService clean
// as it's the only other place that needs this type.
export interface SensorState {
  distance: number;
  colorReflected: number;
  colorID: number; // 0=None, 1=Black, 2=Blue, 3=Green, 4=Yellow, 5=Red, 6=White
  gyro: number;
  leftEncoder: number; // Degrees
  rightEncoder: number; // Degrees
}


@Injectable({ providedIn: 'root' })
export class InputService {
  readonly forward = signal(false);
  readonly backward = signal(false);
  readonly left = signal(false);
  readonly right = signal(false);

  handleKeyDown(key: string) {
    switch (key) {
      case 'w':
      case 'ArrowUp':
        this.forward.set(true);
        break;
      case 's':
      case 'ArrowDown':
        this.backward.set(true);
        break;
      case 'a':
      case 'ArrowLeft':
        this.left.set(true);
        break;
      case 'd':
      case 'ArrowRight':
        this.right.set(true);
        break;
    }
  }

  handleKeyUp(key: string) {
    switch (key) {
      case 'w':
      case 'ArrowUp':
        this.forward.set(false);
        break;
      case 's':
      case 'ArrowDown':
        this.backward.set(false);
        break;
      case 'a':
      case 'ArrowLeft':
        this.left.set(false);
        break;
      case 'd':
      case 'ArrowRight':
        this.right.set(false);
        break;
    }
  }

  stop() {
      this.forward.set(false);
      this.backward.set(false);
      this.left.set(false);
      this.right.set(false);
  }
}
