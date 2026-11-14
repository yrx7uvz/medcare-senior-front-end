/*
 * Ponto de entrada do app: registra o componente raiz no React Native. A tarefa de segundo plano do lembrete de
 * dose é definida antes disso.
 */
import { registerRootComponent } from 'expo';
// Antes de tudo: a tarefa de segundo plano do lembrete de dose precisa estar definida quando o Android sobe o app sem
// tela para rodá-la (reminderTask.ts)
import './src/lib/reminderTask';
import App from './src/app/App';

registerRootComponent(App);
