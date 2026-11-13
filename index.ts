import { registerRootComponent } from 'expo';
// Antes de tudo: a tarefa de segundo plano do lembrete de dose precisa estar definida quando o Android sobe o app sem
// tela para rodá-la (reminderTask.ts)
import './src/lib/reminderTask';
import App from './src/app/App';

registerRootComponent(App);
