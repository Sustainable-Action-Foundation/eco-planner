import { defineConfig } from "cypress";
import PocketBase from 'pocketbase';
import { readdirSync } from 'fs';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const pb = new PocketBase(process.env.POCKETBASE_INSTANCE);

export default defineConfig({
  viewportWidth: 1280, // Set theese to 720p, larger screens do not work due to limitations with XVFB
  viewportHeight: 720,
  e2e: {
    baseUrl: 'http://localhost:3000',
    setupNodeEvents(on) {
      on('after:run', async () => {

        const username = process.env.POCKETBASE_USER
        const password = process.env.POCKETBASE_PASSWORD
        if (username && password) {
          await pb.admins.authWithPassword(username, password); 
        } else {
          console.error('Missing enviroment variables: POCKETBASE_USER, POCKETBASE_PASSWORD')
          return
        }

        // Get screenshots
        const files = readdirSync('./cypress/screenshots/screenshots.cy.ts');

        // Create formdata and append current datetime
        const formData = new FormData();
        formData.append('date', new Date().toISOString().replace('T', ' '))
        
        // Append all screenshots to the formdata
        for (const file of files) {
          const fileContent = readFileSync(`./cypress/screenshots/screenshots.cy.ts/${file}`);
          const screenshot = new File([fileContent], file);
          formData.append('screenshots', screenshot);
        };
        
        await pb.collection('testrun').create(formData);
        pb.authStore.clear();
        
      })
    },
  
  },
}); 