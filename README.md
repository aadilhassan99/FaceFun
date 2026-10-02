# Human Counter

Human Counter is a lightweight, browser-based face detection app built with **Next.js**, **React**, **TypeScript**, **pnpm workspaces**, and **MediaPipe Tasks Vision**.

Use your webcam for live face detection or upload an image to scan it. Detected faces are outlined with green bounding boxes, and the app displays the number of faces detected.

> **Privacy by design:** webcam frames and uploaded images are processed in your browser. The app does not require an application backend, database, or user account.

## Features

- **Live webcam detection** — detect faces in the camera feed in near real time.
- **Image upload** — scan JPG, PNG, WebP, and other image formats supported by your browser.
- **Face count** — see the current number of detected faces.
- **Visual feedback** — green bounding boxes mark detected faces.
- **Browser-based processing** — image and camera data are not uploaded to an application server.
- **Responsive interface** — a simple interface for switching between webcam and image modes.

## Tech stack

- [Next.js](https://nextjs.org/) 15
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [pnpm workspaces](https://pnpm.io/workspaces)
- [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector/web_js)

## Project structure

```text
human-counter/
├── apps/
│   └── web/                  # Next.js web application
│       └── src/
│           ├── app/           # App Router pages, layout, and styles
│           └── components/    # Face detection UI
├── packages/
│   └── vision/               # MediaPipe face detector wrapper
├── package.json              # Root scripts and workspace configuration
├── pnpm-workspace.yaml
└── README.md
```

## Requirements

- **Node.js 20.9 or newer**
- **pnpm 10** (the project declares pnpm `10.17.1`; Corepack is recommended)
- A modern browser
- An internet connection the first time the face detector is initialized, so the MediaPipe runtime and model can be loaded from their configured CDN URLs

Webcam access generally requires a secure context. `http://localhost` is allowed for local development; deployed sites should use HTTPS.

## Getting started

### 1. Enable Corepack

If Corepack is available with your Node.js installation, run:

```bash
corepack enable
```

### 2. Install dependencies

From the repository root, run:

```bash
pnpm install
```

### 3. Start the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- Select **Webcam** and choose **Enable camera** to start live detection. Grant camera permission when prompted.
- Select **Upload image** and choose an image file to scan a photo.
- Use **Stop camera** when you are finished with the webcam.

## Available commands

Run these commands from the repository root:

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the Next.js development server. |
| `pnpm build` | Build the web application for production. |
| `pnpm lint` | Run ESLint for the web application. |

To run the production build locally after building:

```bash
pnpm --filter @human-counter/web start
```

## How it works

1. The web app initializes the face detector from the local `@human-counter/vision` workspace package.
2. MediaPipe processes webcam frames or the selected image in the browser.
3. The app draws a green rectangle around each detected face and updates the displayed count.

## Limitations

- This is **face detection**, not full-body person detection. People whose faces are obscured, turned away, too small, or outside the frame may not be detected.
- The count represents detected faces, not guaranteed unique people. A person may be counted again across different frames; the app does not track identities.
- Detection quality and speed depend on the input image, lighting, camera, browser, and device performance.
- The MediaPipe runtime and model are loaded from external CDN URLs, so an internet connection is needed when they are first initialized. Availability of those external resources may affect startup.
- The app does not currently store scan history or send data to a backend.

## Privacy

Camera access is requested only when you start the webcam. The app stops the camera stream when you stop it or leave the page. Uploaded images and webcam frames are processed client-side and are not sent to an application server by this app. The external MediaPipe runtime and model files are downloaded from the configured CDN URLs.

## Contributing

Contributions and suggestions are welcome. For changes to the detection implementation, keep computer-vision logic in `packages/vision` and user-interface code in `apps/web` where practical.
