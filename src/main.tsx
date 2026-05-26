import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { assertTauri2Runtime } from './lib/tauriVersion';
import './index.css';

void assertTauri2Runtime().catch((err) => {
  console.error(err);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
