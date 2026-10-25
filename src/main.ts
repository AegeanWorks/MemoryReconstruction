/**
 * Memory Reconstruction entry point: boots the renderer, loads sprites behind
 * the loading screen, then hands control to the App state machine.
 */
import './ui/ui.css';
import { App } from './app/App';
import { errorScreen } from './ui/Screens';
import { Renderer } from './view/Renderer';

async function main(): Promise<void> {
  const container = document.getElementById('game-container');
  const ui = document.getElementById('ui');
  const loading = document.getElementById('loading-screen');
  const progress = document.getElementById('loading-progress');
  const label = document.getElementById('loading-text');
  if (!container || !ui) throw new Error('index.html is missing #game-container or #ui');

  const setProgress = (fraction: number, text: string): void => {
    if (progress) progress.style.width = `${Math.round(fraction * 100)}%`;
    if (label) label.textContent = text;
  };

  const renderer = new Renderer();
  try {
    setProgress(0.05, 'Waking the renderer...');
    await renderer.init(container, (f) => setProgress(0.1 + f * 0.85, 'Gathering memories...'));
  } catch (error) {
    loading?.classList.add('hidden');
    const detail = error instanceof Error ? error.message : String(error);
    ui.append(
      errorScreen(
        `The graphics renderer could not start (${detail}).`,
        'Use a current Chrome, Edge or Firefox with hardware acceleration enabled, then reload the page.'
      )
    );
    return;
  }

  const app = new App(renderer, ui);
  app.start();
  setProgress(1, 'Ready');
  loading?.classList.add('hidden');
  // Read-only handle for automated playtests and debugging in the console.
  window.__MR__ = app;
}

void main();
