import { Component, inject } from '@angular/core';
import { SimulationService } from '../services/simulation.service';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-telemetry',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <!-- Minimalist HUD (Top Right) -->
    <div class="absolute top-4 right-4 pointer-events-none select-none transition-opacity duration-300 flex flex-col items-end">
        
        <!-- Main Data Card -->
        <div class="bg-black/70 backdrop-blur-md rounded-xl p-3 border border-white/10 shadow-2xl flex flex-col gap-3 min-w-[140px]">
            
            <!-- Odometry Section -->
            <div class="flex flex-col gap-1">
                <!-- Heading -->
                <div class="flex items-center justify-between text-xs text-white/90">
                    <div class="flex items-center gap-2 text-slate-400" title="Heading">
                        <i class="fas fa-compass text-[10px] w-3 text-center"></i>
                    </div>
                    <div class="font-mono font-bold tracking-tight">
                        {{ sim.robotPosition().r | number:'1.0-0' }}<span class="text-[10px] text-slate-500 ml-0.5">°</span>
                    </div>
                </div>
                <!-- Position X/Z (CM) -->
                <div class="flex items-center justify-between text-xs text-white/90">
                    <div class="flex items-center gap-2 text-slate-400" title="Position">
                        <i class="fas fa-location-dot text-[10px] w-3 text-center"></i>
                    </div>
                    <div class="font-mono font-bold tracking-tight flex items-center">
                        <span class="text-[9px] text-slate-600 mr-0.5">x</span>{{ (sim.robotPosition().x * 100) | number:'1.0-0' }}
                        <span class="text-slate-700 mx-1">|</span>
                        <span class="text-[9px] text-slate-600 mr-0.5">y</span>{{ (sim.robotPosition().z * 100) | number:'1.0-0' }}
                    </div>
                </div>
            </div>

            <div class="h-px bg-white/5 w-full"></div>

            <!-- Sensors Section -->
            <div class="flex flex-col gap-1">
                <!-- Ultrasonic -->
                <div class="flex items-center justify-between text-xs text-white/90">
                    <div class="flex items-center gap-2 text-cyan-400" title="Ultrasonic Distance">
                        <i class="fas fa-ruler-horizontal text-[10px] w-3 text-center"></i>
                    </div>
                    <div class="font-mono font-bold tracking-tight">
                        {{ sim.sensorData().distance | number:'1.0-0' }}<span class="text-[10px] text-slate-500 ml-0.5">cm</span>
                    </div>
                </div>
                <!-- Color -->
                <div class="flex items-center justify-between text-xs text-white/90">
                    <div class="flex items-center gap-2 text-pink-400" title="Reflected Light">
                        <i class="fas fa-lightbulb text-[10px] w-3 text-center"></i>
                    </div>
                    <div class="font-mono font-bold tracking-tight">
                        {{ sim.sensorData().colorReflected | number:'1.0-0' }}<span class="text-[10px] text-slate-500 ml-0.5">%</span>
                    </div>
                </div>
            </div>

            <div class="h-px bg-white/5 w-full"></div>

            <!-- Motors Section -->
            <div class="flex flex-col gap-1.5 pt-0.5">
                <!-- Left Motor -->
                <div class="flex items-center gap-2">
                    <span class="text-[9px] font-bold text-slate-500 w-3 text-right">L</span>
                    <div class="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                        <div class="h-full bg-blue-500 transition-all duration-75 ease-out" 
                             [style.width.%]="Math.abs(sim.motorLSpeed())"></div>
                    </div>
                </div>
                <!-- Right Motor -->
                <div class="flex items-center gap-2">
                    <span class="text-[9px] font-bold text-slate-500 w-3 text-right">R</span>
                    <div class="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                        <div class="h-full bg-blue-500 transition-all duration-75 ease-out" 
                             [style.width.%]="Math.abs(sim.motorRSpeed())"></div>
                    </div>
                </div>
            </div>

        </div>
    </div>
  `
})
export class TelemetryComponent {
  sim = inject(SimulationService);
  Math = Math;
}
