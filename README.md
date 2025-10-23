# Lost & Found UI System

This project uses Vue 3 + Vite with a Bootstrap-first design system. Shared components live under `src/components/ui` and rely on a custom Bootstrap theme defined with CSS variables.

## Getting started

1. Copy `.env.example` to `.env.local` (or `.env`) and fill in your Supabase URL and anon key.

   ```bash
   cp .env.example .env.local
   ```

2. Install dependencies and start the dev server:

   ```bash
   npm install
   npm run dev
   ```

## Design system

### Bootstrap theme

Customizations are defined in `src/assets/index.css`. The file imports Bootstrap's compiled CSS, overrides its CSS variables (brand colors, typography, border radius), and adds utility classes shared across the application. Importing the stylesheet in `src/main.js` automatically applies the theme.

To extend the theme, update or append variables and utility classes in `index.css`. Because the overrides piggyback on Bootstrap's design tokens, you get predictable styling without maintaining a Sass toolchain.

### UI components

Reusable Single File Components are available under `src/components/ui/`:

- `Button.vue` – wraps Bootstrap buttons with variant, size, loading, and icon support.
- `Input.vue` – accessible text, email, password, and numeric inputs with description, validation, and floating-label modes.
- `Select.vue` – enhanced select element that supports options arrays, multiple selection, and validation messaging.
- `Card.vue` – Bootstrap card shell with optional header/footer slots and Lucide icon integration.
- `Modal.vue` – controlled modal dialog with backdrop management and slot-based header/body/footer sections.

Import them directly or through `src/components/ui/index.js`.

```vue
<script setup>
import { UiButton } from '@/components/ui'
import { Plus } from 'lucide-vue-next'
</script>

<template>
  <UiButton :icon="Plus">Create item</UiButton>
</template>
```

### Icons

The project standardizes on [lucide-vue-next](https://www.npmjs.com/package/lucide-vue-next) for icons. Import the icons you need and pass them to UI components via the `icon` prop or dedicated slots. This keeps bundle sizes lean and avoids shipping unused icon sets.

```vue
<script setup>
import { Search } from 'lucide-vue-next'
import { UiButton } from '@/components/ui'
</script>

<template>
  <UiButton variant="outline" :icon="Search">Search reports</UiButton>
</template>
```

## Linting & formatting

```bash
npm run lint
npm run format
```
