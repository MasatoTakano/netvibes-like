## Gemini's Understanding of the Memo App

This document summarizes my understanding of the `memo-app` project based on our interactions.

### Project Overview

This is a web application built with **Nuxt.js (v3)** and **TypeScript**. It provides a customizable dashboard interface, similar to Netvibes, where users can add, arrange, and manage various widgets.

### Core Technologies

- **Frontend:**
  - **Framework:** Nuxt.js (Vue.js 3)
  - **UI Components:** The UI is built with Vue single-file components (`.vue`).
  - **Layout:** `splitpanes` is used for creating resizable panes in the main view.
  - **Drag & Drop:** `vuedraggable` is likely used for rearranging widgets.
  - **Internationalization:** `@nuxtjs/i18n` is used for managing multiple languages (e.g., `en-US`, `ja-JP`).

- \*\*Backend (within Nuxt's `/server` directory):
  - **API:** A server-side API is defined under `/server/api` to handle data persistence and business logic.
  - **Authentication:** User authentication is managed by **Lucia Auth** (`lucia-auth/adapter-prisma`).
  - **Database ORM:** **Prisma** is used to interact with the database.
  - **Database:** Based on the Prisma setup, it likely uses a database like SQLite or PostgreSQL.

### Key Features & Concepts

- **Widget-based Dashboard:** The core of the application is a dashboard composed of widgets. The layout and configuration of these widgets are saved on a per-user basis.
- **Widget Types:** The application supports several types of widgets:
  - **Memo/Note:** A simple text note widget.
  - **RSS Reader:** A widget to display items from an RSS feed.
  - **Google Calendar:** A widget to embed a Google Calendar via an `iframe`.
- **User Authentication:** Users can sign up and log in. The backend API endpoints are protected and require a valid session.
- **Layout Persistence:** The user's widget layout (which widgets are in which pane, their order, and collapsed state) is fetched from `/api/layout` on page load and saved via POST/PUT requests to the same endpoint.
- **Component Structure:**
  - `pages/index.vue`: The main dashboard page that orchestrates the panes and widgets.
  - `components/WidgetCard.vue`: A generic container for all widgets, providing the title bar, collapse/remove/settings buttons.
  - `components/<WidgetType>.vue`: Specific components for each widget's content (e.g., `CalendarWidget.vue`, `RssReader.vue`).
  - `components/*Modal.vue`: Modal dialogs for various settings and actions (e.g., `AddWidgetModal.vue`, `CalendarSettingsModal.vue`).

### Development Workflow

- **Development Server:** The command `npm run dev` starts the Nuxt development server.
- **Dependencies:** Project dependencies are managed with `npm` and defined in `package.json`.

### Recent Changes & Learnings

- **Google Calendar Widget Display Fix:** Initially, Google Calendar widgets were not displaying correctly due to an incorrect `props` declaration in `CalendarWidget.vue` and a missing i18n key for `googleCalendar` in `ja-JP.json`. These issues were resolved by:
  - Correcting `props` declaration in `CalendarWidget.vue` from `declare const props` to `defineProps`.
  - Adding the `widget.types.googleCalendar` key to `i18n/locales/ja-JP.json`.
- **Google Calendar Widget Height Adjustment:** The `iframe` within the Google Calendar widget was not respecting its `height` attribute due to conflicting CSS (`height: 100%` and `flex-grow: 1`) in `CalendarWidget.vue`. This was fixed by removing these conflicting styles, allowing the `iframe`'s intrinsic height to be honored.
- **Google Calendar Dark Mode (Pseudo-Implementation):** Direct dark mode application to the Google Calendar `iframe` is not possible due to browser security policies. A pseudo-dark mode was implemented by applying a CSS `filter: invert(1) hue-rotate(180deg);` to the `iframe` when the application's dark mode is active. This provides a visual dark mode effect, though it may alter the original colors within the calendar content.

検討・コードを生成するときはContext7 MCPで推奨される方法を確認してから行う
