import { Component, inject } from '@angular/core';
import { SimulationService } from '../services/simulation.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  template: `
    <div class="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shadow-sm z-30 font-sans">
      
      <!-- LEFT: Title -->
      <div class="flex items-center space-x-3">
        <img src="https://www.lego.com/cdn/cs/set/assets/blt2647c439369c65ce/45678.png" alt="SPIKE Prime Hub" class="h-9 w-9 object-contain">
        <span class="font-bold text-slate-800 text-lg">Robot Sandbox</span>
      </div>

      <!-- CENTER: Reset Controls -->
      <div class="absolute left-1/2 transform -translate-x-1/2">
        <button (click)="reset()" 
                class="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 hover:shadow-md transition-all active:scale-95 border border-slate-200" 
                title="Reset Robot Position (R)">
            <i class="fas fa-undo text-base"></i>
        </button>
      </div>

      <!-- RIGHT: View Options -->
      <div class="flex items-center space-x-4">
         <div class="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 space-x-1">
            <button title="Orbit Camera (O)" (click)="sim.setCameraMode('ORBIT')"
                    [class.bg-white]="sim.cameraMode === 'ORBIT'"
                    [class.text-blue-600]="sim.cameraMode === 'ORBIT'"
                    [class.shadow-sm]="sim.cameraMode === 'ORBIT'"
                    class="w-9 h-8 rounded flex items-center justify-center text-slate-500 hover:bg-white hover:text-blue-600 transition-all">
                <i class="fas fa-cube"></i>
            </button>
            <button title="Top-Down Camera (T)" (click)="sim.setCameraMode('TOP')"
                    [class.bg-white]="sim.cameraMode === 'TOP'"
                    [class.text-blue-600]="sim.cameraMode === 'TOP'"
                    [class.shadow-sm]="sim.cameraMode === 'TOP'"
                    class="w-9 h-8 rounded flex items-center justify-center text-slate-500 hover:bg-white hover:text-blue-600 transition-all">
                <i class="fas fa-map-location-dot"></i>
            </button>
            <button title="Follow Camera (F)" (click)="sim.setCameraMode('FOLLOW')"
                    [class.bg-white]="sim.cameraMode === 'FOLLOW'"
                    [class.text-blue-600]="sim.cameraMode === 'FOLLOW'"
                    [class.shadow-sm]="sim.cameraMode === 'FOLLOW'"
                    class="w-9 h-8 rounded flex items-center justify-center text-slate-500 hover:bg-white hover:text-blue-600 transition-all">
                <i class="fas fa-video"></i>
            </button>
            <button title="First-Person View (P)" (click)="sim.setCameraMode('FPV')"
                    [class.bg-white]="sim.cameraMode === 'FPV'"
                    [class.text-blue-600]="sim.cameraMode === 'FPV'"
                    [class.shadow-sm]="sim.cameraMode === 'FPV'"
                    class="w-9 h-8 rounded flex items-center justify-center text-slate-500 hover:bg-white hover:text-blue-600 transition-all">
                <i class="fas fa-robot"></i>
            </button>
         </div>
      </div>
    </div>
  `
})
export class ToolbarComponent {
  sim = inject(SimulationService);

  reset() {
    this.sim.resetRobot();
  }
}
