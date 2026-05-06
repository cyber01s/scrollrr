import { spawn } from 'child_process';
const child = spawn('npx', ['next', 'dev', '-H', '0.0.0.0', '-p', '3000'], { stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code || 0));
