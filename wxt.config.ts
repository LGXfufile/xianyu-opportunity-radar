import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

export default defineConfig({
  vite: () => ({ plugins: [react()] }),
  manifest: {
    name: '闲鱼机会雷达',
    description: '用需求、竞争、利润、交付与风险证据发现值得验证的闲鱼产品机会。',
    permissions: ['storage', 'sidePanel', 'alarms', 'tabs'],
    host_permissions: ['https://www.goofish.com/*'],
    action: { default_title: '打开闲鱼机会雷达' },
    side_panel: { default_path: 'sidepanel.html' }
  }
});
