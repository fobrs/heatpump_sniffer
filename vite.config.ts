// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
    
    server: {
        allowedHosts: [  "quatt.bigroses.net"],
        strictPort: true,
        hmr: {
            
            clientPort: 4000,
            protocol: "wss",
           
        },
    },
}
);


