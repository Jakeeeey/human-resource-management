# Human Resource Management System (VOS)

Modern and responsive HR Management system built with Next.js 15, React 19, and Tailwind CSS.

---

## 🚀 Getting Started

Follow these steps to set up the project locally:

### 1. Installation

After cloning the repository, install the necessary dependencies using NPM:

```bash
npm install
```

### 2. Environment Configuration

Create a file named `.env.local` in the root directory of the project and paste the following configuration. Adjust the values as needed for your local or live environments:

```env
# UI-only development
NEXT_PUBLIC_AUTH_DISABLED=false

# --- Directus API Configuration ---
# Dummy Directus
NEXT_PUBLIC_API_BASE_URL=

# Live Directus
# NEXT_PUBLIC_API_BASE_URL=

# --- Spring Boot API Configuration ---
# Jerico Spring Boot
# SPRING_API_BASE_URL=

# PC Spring Boot
# SPRING_API_BASE_URL=

# Sir Andrei Spring Boot
# SPRING_API_BASE_URL=

# Jake Spring Boot
# SPRING_API_BASE_URL=

# --- Auth Configuration ---
# Dummy Directus
DIRECTUS_STATIC_TOKEN=

# Live Directus
# DIRECTUS_STATIC_TOKEN=
```

> [!IMPORTANT]
> Make sure to never commit your `.env.local` file to the repository. It is already included in `.gitignore`.

### 3. Run Development Server

Once the installation and environment setup are complete, you can start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## 🛠 Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **State & Forms**: [React Hook Form](https://react-hook-form.com/), [Zod](https://zod.dev/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/), [Lucide Icons](https://lucide.dev/)
- **Tables**: [TanStack Table](https://tanstack.com/table)
- **Charts**: [Recharts](https://recharts.org/)

---
