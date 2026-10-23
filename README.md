# Kelp: Posture Monitor

A desktop app that uses your webcam to catch bad posture and bad habits in real time, then nudges you to fix them. Built in 24 hours at **Technica 2026** by a team of 4. 

Your health stays on track with a little help from a sea lion Shaun who gets happier when you do.

<img width="1137" height="697" alt="image" src="https://github.com/user-attachments/assets/7b083d0d-757d-40d5-b02e-ce78c1253277" />

## Features

- **Posture detection:** tracks your head and shoulders to flag slouching, leaning, and forward-head posture
- **Calibration:** set your own "good posture" baseline, with a recalibration timer to keep it accurate
- **Adjustable strictness:** choose Gentle or Strict tolerance, depending on how often you glance down at notes
- **Nail-biting detection:** spots when your hand goes to your mouth
- **Stand-up reminders:** tracks how long you've been sitting and sends a desktop notification when it's time to stand
- **Dashboard:** daily progress bars, a good-posture graph, and streaks
- **Mascot:** a sea lion that gets sadder as bad habits pile up or stand-up alerts go unanswered
- **Private by design:** webcam video is processed on your device, and your stats are stored locally in SQLite

## How it works

1. The webcam feed goes through Google's **MediaPipe** pose, face, and hand landmark models.
2. The app measures body ratios from the landmarks (like how close your head is to your shoulders, or how tilted they are) and compares them to your calibrated baseline.
3. When a measurement passes a threshold, it logs the event, updates your dashboard, and sends a notification.

## Built with

- **Electron** for the desktop app
- **React** and **Vite** for the interface
- **Tailwind CSS** and **Recharts** for styling and charts
- **MediaPipe Tasks Vision** for computer vision
- **SQLite** for local data storage

## Run it locally

You'll need [Node.js](https://nodejs.org) installed.

```bash
git clone https://github.com/ananya4198/Kelp.git
cd Kelp
npm install
npm run electron:dev
```

Allow camera access when prompted. The first launch downloads the MediaPipe models, so it needs an internet connection.

To build an installable app:

```bash
npm run electron:build
```

The packaging settings are currently set up for macOS.

## Project structure

```
electron/        Electron main process and local database
src/components/  Dashboard UI (monitor, charts, streaks, preferences)
src/hooks/       Posture, habit, and notification logic
src/lib/         Posture math, MediaPipe setup, database helpers
```

## Team

Built by **Ananya Nakka**, **Sangeetha Sree Selva Kumar**, **Kaelyn Funcion**, and **Lynn Hui**.
