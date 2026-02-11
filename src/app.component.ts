import { Component, ElementRef, ViewChild, AfterViewInit, inject, HostListener } from '@angular/core';
import { ToolbarComponent } from './components/toolbar.component';
import { TelemetryComponent } from './components/telemetry.component';
import { SimulationService } from './services/simulation.service';
import { InputService } from './services/input.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ToolbarComponent, TelemetryComponent],
  template: `
    <div class="flex flex-col h-screen overflow-hidden bg-slate-900 text-white font-sans selection:bg-yellow-500/30">
      <app-toolbar class="flex-none z-50"></app-toolbar>
      <main class="flex-1 relative bg-slate-900">
        
        <!-- Main Simulation Viewport -->
        <canvas #simCanvas class="w-full h-full block outline-none cursor-move"></canvas>
        
        <!-- UI Overlays -->
        <app-telemetry class="z-20"></app-telemetry>
        
        <!-- Controls Helper UI -->
        <div class="absolute bottom-4 left-4 z-20 pointer-events-none select-none">
          <div class="flex items-end gap-2 text-slate-300">
            <!-- WASD Keys -->
            <div class="flex flex-col items-center gap-1">
                <div class="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-lg border border-white/10 flex items-center justify-center font-bold text-lg">W</div>
                <div class="flex gap-1">
                    <div class="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-lg border border-white/10 flex items-center justify-center font-bold text-lg">A</div>
                    <div class="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-lg border border-white/10 flex items-center justify-center font-bold text-lg">S</div>
                    <div class="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-lg border border-white/10 flex items-center justify-center font-bold text-lg">D</div>
                </div>
            </div>
             <!-- Spacebar -->
            <div class="h-12 px-4 bg-black/50 backdrop-blur-sm rounded-lg border border-white/10 flex items-center justify-center font-bold text-sm">SPACE: STOP</div>
          </div>
        </div>

        <!-- Vignette Effect Overlay -->
        <div class="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(15,23,42,0.4)_100%)] z-10"></div>
      </main>
    </div>
  `
})
export class AppComponent implements AfterViewInit {
  @ViewChild('simCanvas') simCanvas!: ElementRef<HTMLCanvasElement>;
  
  simService = inject(SimulationService);
  inputService = inject(InputService);

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return; // Ignore keyboard events if user is typing in an input
    }

    if ('wasd ArrowUp ArrowDown ArrowLeft ArrowRight r o t f p'.includes(event.key.toLowerCase())) {
      event.preventDefault();
    }
    
    // Robot movement controls
    if (event.key === ' ') {
        this.inputService.stop();
        this.simService.stopRobot();
    } else {
        this.inputService.handleKeyDown(event.key);
    }
    
    // Simulation and camera controls
    switch(event.key.toLowerCase()) {
        case 'r': this.simService.resetRobot(); break;
        case 'o': this.simService.setCameraMode('ORBIT'); break;
        case 't': this.simService.setCameraMode('TOP'); break;
        case 'f': this.simService.setCameraMode('FOLLOW'); break;
        case 'p': this.simService.setCameraMode('FPV'); break;
    }
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyUp(event: KeyboardEvent) {
    this.inputService.handleKeyUp(event.key);
  }

  ngAfterViewInit() {
    this.simService.init(this.simCanvas.nativeElement);

    const resizeObs = new ResizeObserver(entries => {
        for(let entry of entries) {
            this.simService.resize(entry.contentRect.width, entry.contentRect.height);
        }
    });
    resizeObs.observe(this.simCanvas.nativeElement.parentElement!);
  }
}
