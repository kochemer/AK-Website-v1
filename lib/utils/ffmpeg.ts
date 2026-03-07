/**
 * FFmpeg utility functions
 */

import { spawn } from 'child_process';

/**
 * Assert that ffmpeg is installed and available in PATH.
 * Throws a clear error with installation instructions if missing.
 */
export async function assertFfmpegInstalled(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-version'], { stdio: 'ignore' });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(
          'ffmpeg is not installed or not found in PATH.\n\n' +
          'Installation instructions:\n' +
          '  macOS:     brew install ffmpeg\n' +
          '  Ubuntu:    sudo apt-get update && sudo apt-get install -y ffmpeg\n' +
          '  Windows:   winget install Gyan.FFmpeg\n' +
          '  Or visit:  https://ffmpeg.org/download.html'
        ));
      }
    });

    proc.on('error', () => {
      reject(new Error(
        'ffmpeg is not installed or not found in PATH.\n\n' +
        'Installation instructions:\n' +
        '  macOS:     brew install ffmpeg\n' +
        '  Ubuntu:    sudo apt-get update && sudo apt-get install -y ffmpeg\n' +
        '  Windows:   winget install Gyan.FFmpeg\n' +
        '  Or visit:  https://ffmpeg.org/download.html'
      ));
    });
  });
}
