<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/996f25e1-7b6f-4376-8cfc-18c70cccc8fb

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key (see `.env.example`)
3. Run the app for development:
   `npm run dev`
4. Build the app for production:
   `npm run build`
5. Start the production server:
   `npm start`

## Deployment

This project includes a custom GitHub Action workflow to test, build, and deploy your app. Since this application requires a Node.js backend (`server.ts`) for Socket.io networking, it cannot be hosted completely on a static site provider like GitHub Pages.

To perform a continuous deployment:
1. Ensure your `.github/workflows/deploy.yml` is pushed to GitHub.
2. Select a cloud provider capable of running Node.js servers, such as **Render**, **Fly.io**, **Google Cloud Run**, or a self-hosted **VPS**.
3. For automated deployment, use the template in `deploy.yml` and provide your secrets to GitHub Repository Settings > Secrets and Variables > Actions.
