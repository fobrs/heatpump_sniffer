// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
    
    server: {
        allowedHosts: [  "quatt.bigroses.net"],
        strictPort: true,
        ws : false,
        hmr: {
            
            clientPort: 4000,
            protocol: "wss",
           
        },
    },
}
);


