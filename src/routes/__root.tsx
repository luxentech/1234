import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0b1230" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Elevate" },
      { title: "Elevate — اكتشف فرصتك التالية" },
      {
        name: "description",
        content:
          "Elevate هي منصتك الشاملة لاكتشاف المسابقات والمنح الدراسية وفرص التطوع والوظائف للطلاب والخريجين.",
      },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Elevate — اكتشف فرصتك التالية" },
      {
        property: "og:description",
        content:
          "Elevate هي منصتك الشاملة لاكتشاف المسابقات والمنح الدراسية وفرص التطوع والوظائف للطلاب والخريجين.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Elevate — اكتشف فرصتك التالية" },
      {
        name: "twitter:description",
        content:
          "Elevate هي منصتك الشاملة لاكتشاف المسابقات والمنح الدراسية وفرص التطوع والوظائف للطلاب والخريجين.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/59fba907-3f47-4dd5-86e8-771e7ffd8be5/id-preview-68176809--07f4150e-2968-47d4-b034-21c23ed9475e.lovable.app-1785445432410.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/59fba907-3f47-4dd5-86e8-771e7ffd8be5/id-preview-68176809--07f4150e-2968-47d4-b034-21c23ed9475e.lovable.app-1785445432410.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icons/icon-512.png" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** Offers "add to home screen" when the browser says the site is installable. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

function PwaInstall() {
  const [available, setAvailable] = useState<InstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem("ns_pwa_hidden") === "1") return;
    } catch {
      /* ignore storage error */
    }

    const onAvailable = (event: Event) => {
      event.preventDefault();
      setAvailable(event as unknown as InstallPromptEvent);
    };
    const onInstalled = () => setAvailable(null);

    window.addEventListener("beforeinstallprompt", onAvailable);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onAvailable);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!available || hidden) return null;

  const install = async () => {
    const event = available;
    setAvailable(null);
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      /* ignore install cancellation */
    }
  };

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem("ns_pwa_hidden", "1");
    } catch {
      /* ignore storage error */
    }
  };

  return (
    <div
      dir="rtl"
      style={{
        position: "fixed",
        bottom: 18,
        insetInlineEnd: 18,
        zIndex: 2147483646,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 11px",
        borderRadius: 14,
        background: "#0f172a",
        color: "#e2e8f0",
        border: "1px solid rgba(255,255,255,.14)",
        boxShadow: "0 14px 34px rgba(2,6,23,.45)",
        fontFamily: "Tajawal, system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      <img src="/icons/icon-192.png" alt="" width={30} height={30} style={{ borderRadius: 8 }} />
      <span>ثبّت Elevate على موبايلك</span>
      <button
        onClick={install}
        style={{
          font: "inherit",
          fontWeight: 800,
          cursor: "pointer",
          padding: "7px 14px",
          borderRadius: 10,
          border: "none",
          background: "linear-gradient(135deg, #34d399, #22d3ee)",
          color: "#04241a",
        }}
      >
        تثبيت
      </button>
      <button
        onClick={dismiss}
        aria-label="إغلاق"
        style={{
          font: "inherit",
          cursor: "pointer",
          padding: "6px 9px",
          borderRadius: 8,
          background: "transparent",
          color: "#94a3b8",
          border: "1px solid rgba(255,255,255,.12)",
        }}
      >
        ✕
      </button>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <PwaInstall />
    </QueryClientProvider>
  );
}
