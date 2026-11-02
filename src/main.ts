import './style.css';
import { App } from './app/App';

const root = document.getElementById('app');
if (!root) throw new Error('#app 이 없습니다');
const app = new App(root);
app.start();

// 개발 서버에서만: 브라우저 콘솔에서 __app.world 로 sim 상태를 들여다보고 조작할 수 있다
if (import.meta.env.DEV) (window as unknown as { __app: App }).__app = app;
