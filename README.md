# Japa Counter App

A modern, spiritual companion for your daily Japa meditation. This application helps practitioners track their mantra chanting, participate in community pledges, and monitor their spiritual progress.

![Japa App Screenshot](https://via.placeholder.com/800x400?text=Japa+Counter+App+Preview)

## 🌟 Features

*   **Digital Japa Counter**:
    *   Target-tracking (108 beads per Mala).
    *   Visual bead ring interface.
    *   Haptic feedback and soothing sound effects.
    *   Session management (Start, Pause, Resume, Reset).
*   **Community Pledges**:
    *   Join collective spiritual goals.
    *   Create and manage group pledges.
    *   Track individual contributions to global targets.
*   **User Profiles**:
    *   Personal statistics and streak tracking.
    *   History of completed Malas.
    *   Authenticated experience using Firebase Auth.
*   **Offline Support**:
    *   Works offline and syncs progress when connectivity returns.
    *   Local storage persistence.
*   **Responsive Deployment**:
    *   Optimized for both Desktop and Mobile web experiences.

## 🛠️ Tech Stack

*   **Frontend**: React, TypeScript, Vite
*   **Styling**: TailwindCSS, Material UI (MUI), Framer Motion
*   **Backend / Serverless**: Firebase (Firestore, Authentication, Hosting)
*   **State Management**: React Context API
*   **Icons**: Lucide React, MUI Icons

## 🚀 Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (v16 or higher)
*   [npm](https://www.npmjs.com/)
*   A Firebase project project [Google Firebase Console](https://console.firebase.google.com/)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/ramdhavepreetam/JapaApp.git
    cd JapaApp
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env.local` file in the root directory with your Firebase configuration credentials:
    ```env
    VITE_FIREBASE_API_KEY=your_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
    VITE_FIREBASE_APP_ID=your_app_id
    ```

### Running Locally

Start the development server:

```bash
npm run dev
```

Visit `http://localhost:5173` (or the port shown in your terminal) to view the app.

## 📦 Building and Deployment

### Build for Production

Generate the production-ready assets in the `dist` folder:

```bash
npm run build
```

### Deploy to Firebase

The project is configured for Firebase Hosting.

1.  **Login to Firebase CLI**
    ```bash
    npx firebase login
    ```

2.  **Deploy**
    ```bash
    npx firebase deploy --only hosting
    ```
    *Note: Ensure you have initialized the firebase project or updated `.firebaserc` with your correct project ID.*

## 📂 Project Structure

```
JapaApp/
├── src/
│   ├── components/      # Reusable UI components (JapaCounter, BeadRing, etc.)
│   ├── contexts/        # React Context providers (Auth, Community)
│   ├── lib/             # Utility libraries (Firebase setup, Storage login)
│   ├── services/        # API services (UserService, CommunityService)
│   ├── App.tsx          # Main application layout and routing
│   └── main.tsx         # Entry point
├── public/              # Static assets
├── firebase.json        # Firebase hosting configuration
├── tailwind.config.js   # TailwindCSS configuration
└── vite.config.ts       # Vite configuration
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

[MIT](LICENSE)
